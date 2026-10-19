"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import {
  useCreateDepartmentMutation,
  useGetDepartmentMembersQuery,
  useUpdateDepartmentMutation,
  type DepartmentChartNode,
  type StaffPlacement,
} from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";
import { DepartmentPreview } from "./DepartmentPreview";
import { PeoplePicker, type ChosenPerson } from "./PeoplePicker";
import { descendantIds, suggestDepartmentCode } from "./tree";
import "../../api";

const FORM_ID = "department-wizard-form";

/** Key of the "top level" option of the parent select (a real id is a number, never this). */
const TOP = "top";

/** The server keeps heads and deputies as full sets, and lists at most this many of each (the details panel asks the same). */
const LEADERS_PAGE_SIZE = 100;

/** Longest description the server accepts. */
const MAX_DESCRIPTION = 1000;

/** The fields of the first step, which a validation error can be shown under. */
const INFO_FIELDS = ["name", "code", "description", "parentId"];

type Step = "info" | "staff";

type Props = {
  mode: "create" | "edit";
  /** The department being edited (edit mode). */
  department?: DepartmentChartNode;
  /** The parent chosen at the start (create mode; edit mode starts from the department's own parent); null is the top level. */
  parentId?: number | null;
  /** The chart's departments: the parent choices (active ones), and where to find the department's descendants. */
  nodes: DepartmentChartNode[];
  organizationName: string;
  onClose: () => void;
  /** The department exists (created) or was changed (edited): its id, so the chart can select it. The wizard closes after. */
  onSaved: (id: number) => void;
};

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * The create and edit wizard of a department: "Thông tin" (parent, name, description, code) and "Nhân sự" (heads,
 * deputies, staff and how the chosen people are placed), with a live preview of the card on the right. Create mode
 * walks the steps with "Tiếp" (and can create from the first step, which adds no staff); edit mode lets both steps be
 * opened freely. The code follows the name (see `suggestDepartmentCode`) until it is typed by hand. A person can be
 * in one picker only, so what one picker chose is disabled in the others; the server's field errors are still shown
 * (under the field, or under the picker). Closing with changes asks first, in the dialog itself.
 *
 * Edit mode: the server takes heads and deputies as FULL sets and demotes anyone left out, so the pickers start from
 * the current heads and deputies (read with the members query) and Save waits until both are loaded; the third picker
 * only adds staff ("newMemberIds"). The name field holds the untranslated name, sent as both `name` and
 * `originalName`, so a translated display name never overwrites the stored one.
 */
export function DepartmentWizard({ mode, department, parentId = null, nodes, organizationName, onClose, onSaved }: Props) {
  const { t } = useLocale();
  const isEdit = mode === "edit" && department !== undefined;
  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();

  // Edit mode reads the current heads and deputies afresh (a stale copy would demote whoever it lacks).
  const leaders = (role: "Head" | "Deputy") => ({
    id: department?.id ?? 0,
    role,
    pageNumber: 1,
    pageSize: LEADERS_PAGE_SIZE,
  });
  const options = { skip: !isEdit, refetchOnMountOrArgChange: true };
  const headsQuery = useGetDepartmentMembersQuery(leaders("Head"), options);
  const deputiesQuery = useGetDepartmentMembersQuery(leaders("Deputy"), options);
  const loadedHeads: ChosenPerson[] = useMemo(
    () => (headsQuery.data?.items ?? []).map((member) => ({ id: member.userId, fullName: member.fullName })),
    [headsQuery.data],
  );
  const loadedDeputies: ChosenPerson[] = useMemo(
    () => (deputiesQuery.data?.items ?? []).map((member) => ({ id: member.userId, fullName: member.fullName })),
    [deputiesQuery.data],
  );
  const leadersLoaded =
    !isEdit || (headsQuery.isSuccess && !headsQuery.isFetching && deputiesQuery.isSuccess && !deputiesQuery.isFetching);
  // Only the first page is read: with more, the sets would be incomplete and saving would demote whoever is missing.
  const leadersTooMany = isEdit && leadersLoaded && (headsQuery.data?.hasNextPage === true || deputiesQuery.data?.hasNextPage === true);
  // Until the current sets are in (and complete) the head and deputy pickers do not exist and Save is off: a pick made
  // earlier would replace the loaded set and leave the real heads out.
  const leadersReady = leadersLoaded && !leadersTooMany;
  const leadersFailed = isEdit && (headsQuery.isError || deputiesQuery.isError);

  const initialParent = isEdit ? (department.parentId ?? null) : parentId;
  const initialName = isEdit ? department.originalName : "";
  const initialDescription = isEdit ? (department.description ?? "") : "";

  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState(initialName);
  // null until typed by hand: then the code is the suggestion for the name (an existing department keeps its own).
  const [typedCode, setTypedCode] = useState<string | null>(isEdit ? department.code : null);
  const [description, setDescription] = useState(initialDescription);
  const [parent, setParent] = useState<number | null>(initialParent);
  // null until the person picks: then the current set is what is chosen (edit mode).
  const [pickedHeads, setPickedHeads] = useState<ChosenPerson[] | null>(null);
  const [pickedDeputies, setPickedDeputies] = useState<ChosenPerson[] | null>(null);
  const [members, setMembers] = useState<ChosenPerson[]>([]);
  const [placement, setPlacement] = useState<StaffPlacement>("Transfer");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const code = typedCode ?? suggestDepartmentCode(name);
  const heads = pickedHeads ?? loadedHeads;
  const deputies = pickedDeputies ?? loadedDeputies;

  const isDirty =
    name !== initialName ||
    description !== initialDescription ||
    code !== (isEdit ? department.code : "") ||
    parent !== initialParent ||
    (pickedHeads !== null && !sameIds(pickedHeads.map((p) => p.id), loadedHeads.map((p) => p.id))) ||
    (pickedDeputies !== null && !sameIds(pickedDeputies.map((p) => p.id), loadedDeputies.map((p) => p.id))) ||
    members.length > 0 ||
    placement !== "Transfer";

  // Active departments, minus (in edit mode) the department itself and everything below it; the department's current
  // parent stays listed even if it was deactivated since, so the select can still show it.
  const parentOptions = useMemo(() => {
    const excluded = isEdit ? descendantIds(nodes, department.id).add(department.id) : new Set<number>();
    return nodes.filter((node) => !excluded.has(node.id) && (node.isActive || node.id === initialParent));
  }, [nodes, isEdit, department, initialParent]);
  const parentName = (parent === null ? null : nodes.find((node) => node.id === parent)?.name) ?? organizationName;

  const chosenIds = new Set([...heads, ...deputies, ...members].map((person) => person.id));
  const previewCount = isEdit ? department.memberCount + members.length : chosenIds.size;

  function requestClose() {
    if (isDirty) setConfirmingClose(true);
    else onClose();
  }

  /** The name and the code are required: said under the fields, on the first step. Returns whether both are there. */
  function checkInfo(): boolean {
    const missing: Record<string, string[]> = {};
    if (!name.trim()) missing.name = [t("departments.wizard.nameRequired")];
    if (!code.trim()) missing.code = [t("departments.wizard.codeRequired")];
    setFieldErrors(missing);
    if (Object.keys(missing).length === 0) return true;
    setStep("info");
    return false;
  }

  function next() {
    if (checkInfo()) setStep("staff");
  }

  async function save() {
    setError(null);
    if (!checkInfo()) return;
    const common = {
      code: code.trim(),
      name: name.trim(),
      description: description.trim() || null,
      parentId: parent,
      headIds: heads.map((person) => person.id),
      deputyIds: deputies.map((person) => person.id),
      placement,
    };
    try {
      let id: number;
      if (isEdit) {
        // The untranslated name goes as both fields; the translated one is never sent back.
        await updateDepartment({
          id: department.id,
          updateDepartmentCommand: { ...common, originalName: name.trim(), newMemberIds: members.map((person) => person.id) },
        }).unwrap();
        id = department.id;
      } else {
        id = await createDepartment({ createDepartmentCommand: { ...common, memberIds: members.map((person) => person.id) } }).unwrap();
      }
      toast.success(t(isEdit ? "departments.wizard.saved" : "departments.wizard.created"));
      onSaved(id);
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, [...INFO_FIELDS, "headIds", "deputyIds", "memberIds", "newMemberIds"]);
      setFieldErrors(found);
      // What no field can show (an inactive department's refusal, a list item) is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
      // Show the step the error is on.
      if (INFO_FIELDS.some((field) => field in found)) setStep("info");
      else if (Object.keys(found).length > 0) setStep("staff");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter walks forward: it never saves from the first step by accident.
    if (step === "info") next();
    else if (leadersReady) void save();
  }

  const isSaving = isCreating || isUpdating;
  const infoFieldErrors = Object.fromEntries(Object.entries(fieldErrors).filter(([field]) => INFO_FIELDS.includes(field)));
  const pickerError = (field: string) =>
    fieldErrors[field] && (
      <p role="alert" className="text-sm text-danger">
        {fieldErrors[field].join(" ")}
      </p>
    );

  const steps: { id: Step; label: string }[] = [
    { id: "info", label: t("departments.wizard.stepInfo") },
    { id: "staff", label: t("departments.wizard.stepStaff") },
  ];

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && requestClose()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog className="sm:max-w-4xl">
          {!confirmingClose && <Modal.CloseTrigger aria-label={t("admin.close")} />}
          <Modal.Header>
            <Modal.Heading>{t(isEdit ? "departments.wizard.editTitle" : "departments.wizard.createTitle")}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4 p-1">
            <ol aria-label={t("departments.wizard.steps")} className="flex items-center gap-2 text-sm">
              {steps.map(({ id, label }, index) => (
                <li key={id} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
                  {/* Create mode reaches the second step with "Tiếp" (after the first is valid); edit mode may go either way. */}
                  {isEdit ? (
                    <button
                      type="button"
                      aria-current={step === id ? "step" : undefined}
                      onClick={() => setStep(id)}
                      className={`rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-focus ${step === id ? "bg-accent text-accent-foreground" : "hover:bg-default"}`}
                    >
                      {label}
                    </button>
                  ) : (
                    <span aria-current={step === id ? "step" : undefined} className={`rounded-lg px-2 py-1 ${step === id ? "bg-accent text-accent-foreground" : "text-muted"}`}>
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ol>

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
              <Form id={FORM_ID} className="flex min-w-0 flex-col gap-4" validationErrors={infoFieldErrors} onSubmit={submit}>
                {step === "info" ? (
                  <>
                    <Select
                      fullWidth
                      name="parentId"
                      variant="secondary"
                      selectedKey={parent === null ? TOP : String(parent)}
                      onSelectionChange={(key) => setParent(key === null || key === TOP ? null : Number(key))}
                    >
                      <Label>{t("departments.wizard.parent")}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {[
                            { id: TOP, name: t("departments.wizard.topLevel").replace("{name}", organizationName) },
                            ...parentOptions.map((node) => ({ id: String(node.id), name: node.name })),
                          ].map((option) => (
                            <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
                              {option.name}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                      <FieldError />
                    </Select>
                    <TextField name="name" autoFocus value={name} onChange={setName} variant="secondary">
                      <Label>{t("departments.wizard.name")}</Label>
                      <Input autoComplete="off" />
                      <FieldError />
                    </TextField>
                    <TextField name="description" value={description} onChange={setDescription} maxLength={MAX_DESCRIPTION} variant="secondary">
                      <Label>{t("departments.wizard.description")}</Label>
                      <TextArea rows={3} />
                      <FieldError />
                    </TextField>
                    <TextField name="code" value={code} onChange={setTypedCode} variant="secondary">
                      <Label>{t("departments.wizard.code")}</Label>
                      <Input autoComplete="off" />
                      <FieldError />
                    </TextField>
                  </>
                ) : (
                  <>
                    {leadersFailed && (
                      <Alert status="danger" role="alert">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Description>{t("departments.wizard.loadError")}</Alert.Description>
                        </Alert.Content>
                        <Button size="sm" variant="secondary" onPress={() => { void headsQuery.refetch(); void deputiesQuery.refetch(); }}>
                          {t("admin.retry")}
                        </Button>
                      </Alert>
                    )}
                    {leadersTooMany && (
                      <Alert status="danger" role="alert">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Description>{t("departments.wizard.tooMany").replace("{count}", String(LEADERS_PAGE_SIZE))}</Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}
                    {!leadersReady && !leadersFailed && !leadersTooMany && (
                      <div className="flex justify-center py-4">
                        <Spinner size="sm" aria-label={t("admin.opening")} />
                      </div>
                    )}
                    {leadersReady && (
                    <>
                    <div className="flex flex-col gap-1">
                      <PeoplePicker
                        label={t("departments.wizard.head")}
                        value={heads.map((person) => person.id)}
                        knownPeople={heads}
                        onChange={(_, people) => setPickedHeads(people)}
                        disabledIds={[...deputies, ...members].map((person) => person.id)}
                        hint={t("departments.wizard.multipleHint")}
                      />
                      {pickerError("headIds")}
                    </div>
                    <div className="flex flex-col gap-1">
                      <PeoplePicker
                        label={t("departments.wizard.deputy")}
                        value={deputies.map((person) => person.id)}
                        knownPeople={deputies}
                        onChange={(_, people) => setPickedDeputies(people)}
                        disabledIds={[...heads, ...members].map((person) => person.id)}
                        hint={t("departments.wizard.multipleHint")}
                      />
                      {pickerError("deputyIds")}
                    </div>
                    </>
                    )}
                    <div className="flex flex-col gap-1">
                      <PeoplePicker
                        label={t(isEdit ? "departments.wizard.newMember" : "departments.wizard.member")}
                        value={members.map((person) => person.id)}
                        knownPeople={members}
                        onChange={(_, people) => setMembers(people)}
                        disabledIds={[...heads, ...deputies].map((person) => person.id)}
                      />
                      {pickerError("memberIds")}
                      {pickerError("newMemberIds")}
                    </div>
                    <RadioGroup variant="secondary" value={placement} onChange={(value) => setPlacement(value as StaffPlacement)}>
                      <Label>{t("departments.wizard.placement")}</Label>
                      <Radio value="Transfer">
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          {t("departments.wizard.transfer")}
                        </Radio.Content>
                      </Radio>
                      <Radio value="Alongside">
                        <Radio.Content>
                          <Radio.Control>
                            <Radio.Indicator />
                          </Radio.Control>
                          {t("departments.wizard.alongside")}
                        </Radio.Content>
                      </Radio>
                    </RadioGroup>
                  </>
                )}
              </Form>

              <DepartmentPreview parentName={parentName} name={name} heads={heads} deputies={deputies} memberCount={previewCount} />
            </div>

            {error && (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Modal.Body>

          <Modal.Footer>
            {confirmingClose ? (
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <p role="alert" className="text-sm">{t("departments.wizard.closeAsk")}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" onPress={() => setConfirmingClose(false)}>
                    {t("departments.wizard.stay")}
                  </Button>
                  <Button variant="danger" onPress={onClose}>
                    {t("departments.wizard.closeConfirm")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* On the first step there is no step to go back to: it leaves the wizard (asking first if anything was entered). */}
                <Button variant="secondary" onPress={step === "info" ? requestClose : () => setStep("info")}>
                  {t("departments.wizard.back")}
                </Button>
                {step === "info" ? (
                  <>
                    {/* Renaming or moving needs no second step: edit mode saves from here too (once the leaders are known, as on step 2). */}
                    <Button variant="secondary" isPending={isSaving} isDisabled={isEdit && !leadersReady} onPress={() => void save()}>
                      {t(isEdit ? "departments.wizard.save" : "departments.wizard.create")}
                    </Button>
                    <Button onPress={next}>{t("departments.wizard.next")}</Button>
                  </>
                ) : (
                  <Button isPending={isSaving} isDisabled={!leadersReady} onPress={() => void save()}>
                    {t(isEdit ? "departments.wizard.save" : "departments.wizard.create")}
                  </Button>
                )}
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
