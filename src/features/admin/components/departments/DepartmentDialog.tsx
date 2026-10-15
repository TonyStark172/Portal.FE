"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Modal, TextField, toast } from "@heroui/react";
import { useCreateDepartmentMutation, type DepartmentTreeNode } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { suggestCode } from "../../lib/codes";
import { splitValidationErrors } from "../../lib/validationErrors";
import { ParentSelect } from "./ParentSelect";

const FORM_ID = "department-form";
/** The name of the submit button that keeps the dialog open for the next department. */
const ADD_ANOTHER = "add-another";

type Props = {
  tree: DepartmentTreeNode[];
  /** The department it starts under (null = the top level); it can be changed in the dialog. */
  parentId: number | null;
  onClose: () => void;
};

/**
 * Adds departments: a name, a code suggested from the name until the user types one, and the department it is part
 * of. "Save & add another" keeps the dialog open with the same parent, for building a whole structure in one go.
 * The parent mounts it afresh each time it opens.
 */
export function DepartmentDialog({ tree, parentId: initialParentId, onClose }: Props) {
  const { t } = useLocale();
  const [createDepartment, { isLoading }] = useCreateDepartmentMutation();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [parentId, setParentId] = useState(initialParentId);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  // Bumped after "save & add another", so the emptied name field takes the focus again.
  const [round, setRound] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const addAnother = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === ADD_ANOTHER;
    setFieldErrors({});
    setError(null);
    try {
      await createDepartment({ createDepartmentCommand: { code: code.trim(), name: name.trim(), parentId } }).unwrap();
      toast.success(t("admin.departmentSaved"));
      if (!addAnother) {
        onClose();
        return;
      }
      setName("");
      setCode("");
      setCodeTouched(false);
      setRound((count) => count + 1);
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, ["name", "code", "parentId"]);
      setFieldErrors(found);
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header className="pe-8">
            <Modal.Heading>{t("admin.createDepartment")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
              <TextField key={round} name="name" isRequired autoFocus value={name} variant="secondary"
                onChange={(value) => { setName(value); if (!codeTouched) setCode(suggestCode(value)); }}>
                <Label>{t("admin.departmentName")}</Label>
                <Input />
                <FieldError />
              </TextField>
              <TextField name="code" isRequired value={code} variant="secondary"
                onChange={(value) => { setCode(value); setCodeTouched(true); }}>
                <Label>{t("admin.code")}</Label>
                <Input />
                <FieldError />
              </TextField>
              <ParentSelect tree={tree} value={parentId} onChange={setParentId} />
            </Form>
            {error && (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer className="flex-wrap">
            <Button slot="close" variant="tertiary">{t("admin.cancel")}</Button>
            <Button type="submit" form={FORM_ID} name={ADD_ANOTHER} variant="secondary" isDisabled={isLoading}>
              {t("admin.saveAndAddAnother")}
            </Button>
            <Button type="submit" form={FORM_ID} isPending={isLoading}>{t("admin.save")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
