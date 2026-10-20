"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Label, Modal, Radio, RadioGroup, toast } from "@heroui/react";
import { useAppDispatch } from "@/core/hooks";
import { portalApi, useAddDepartmentMembersMutation, type DepartmentRole, type StaffPlacement } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { PeoplePicker } from "./PeoplePicker";
import "../../api";

const FORM_ID = "add-department-members-form";

type Props = {
  departmentId: number;
  /**
   * What is being added. "alongside": employees who keep their own department and also work here (the card menu's
   * "Thêm nhân viên đa phòng ban"). "transfer": employees moved here out of their old department ("Chuyển nhân viên về
   * phòng này"). Both add plain members and have no choice to make. "role": people given `role` here, with a choice
   * between moving them out of their old department (the default) and keeping them there.
   */
  mode: "alongside" | "transfer" | "role";
  /** The role given in "role" mode; ignored by the other two (they add members). */
  role?: DepartmentRole;
  onClose: () => void;
};

/** The page size the members endpoint allows at most. */
const MEMBERS_PAGE_SIZE = 100;

/** Pages read at most (a department of that many people is far beyond a chart's use). */
const MAX_MEMBER_PAGES = 50;

/**
 * The ids of everyone in the department now (any role), read page by page, so the picker can refuse them: adding an
 * existing member would only reset their role (a head or deputy would silently become a plain member), and promotion
 * has its own menu on the member's row. Empty until read, and left as read so far if a page fails (the server still
 * decides).
 */
function useCurrentMemberIds(departmentId: number): number[] {
  const dispatch = useAppDispatch();
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found: number[] = [];
      for (let pageNumber = 1; pageNumber <= MAX_MEMBER_PAGES; pageNumber++) {
        // `forceRefetch`: the cache may hold a list from before the last change.
        const request = dispatch(
          portalApi.endpoints.getDepartmentMembers.initiate({ id: departmentId, pageNumber, pageSize: MEMBERS_PAGE_SIZE }, { forceRefetch: true }),
        );
        const page = await request.unwrap().catch(() => null);
        request.unsubscribe();
        if (cancelled || !page) return;
        found.push(...page.items.map((member) => member.userId));
        setIds([...found]);
        if (pageNumber >= page.totalPages) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, departmentId]);

  return ids;
}

/** The title of the dialog and its people field, by what is added. */
const TITLES = {
  alongside: "departments.action.addAlongside",
  transfer: "departments.action.transferIn",
  Head: "departments.addMembers.head",
  Deputy: "departments.addMembers.deputy",
  Member: "departments.addMembers.member",
} as const;

/**
 * Adds people to a department (`POST /api/Departments/{id}/members`): chosen with {@link PeoplePicker}, in the way the
 * mode says. People already in the department are listed but cannot be chosen (see {@link useCurrentMemberIds}).
 * The parent mounts it only while it is open, so each opening starts empty. On success a toast says so and
 * the dialog closes (the mutation refreshes the chart and the lists); when the server refuses, its reason is shown
 * in the dialog and the choice stays so it can be corrected.
 */
export function AddMembersDialog({ departmentId, mode, role = "Member", onClose }: Props) {
  const { t } = useLocale();
  const [addMembers, { isLoading }] = useAddDepartmentMembersMutation();
  const [userIds, setUserIds] = useState<number[]>([]);
  const [keepOldDepartment, setKeepOldDepartment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentMemberIds = useCurrentMemberIds(departmentId);

  const addedRole: DepartmentRole = mode === "role" ? role : "Member";
  const placement: StaffPlacement = mode === "alongside" || (mode === "role" && keepOldDepartment) ? "Alongside" : "Transfer";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Nobody chosen is nothing to send (the button is disabled, but a form can also be submitted by the keyboard).
    if (userIds.length === 0) return;
    setError(null);
    try {
      await addMembers({ id: departmentId, addDepartmentMembersCommand: { userIds, role: addedRole, placement } }).unwrap();
      toast.success(t("departments.toast.added"));
      onClose();
    } catch (failure) {
      setError(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t(TITLES[mode === "role" ? addedRole : mode])}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={submit}>
              {mode === "role" && (
                <RadioGroup
                  variant="secondary"
                  value={keepOldDepartment ? "alongside" : "transfer"}
                  onChange={(value) => setKeepOldDepartment(value === "alongside")}
                >
                  <Label>{t("departments.addMembers.placement")}</Label>
                  <Radio value="transfer">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {t("departments.addMembers.transfer")}
                    </Radio.Content>
                  </Radio>
                  <Radio value="alongside">
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {t("departments.addMembers.alongside")}
                    </Radio.Content>
                  </Radio>
                </RadioGroup>
              )}
              <PeoplePicker label={t("departments.addMembers.people")} value={userIds} onChange={setUserIds} disabledIds={currentMemberIds} />
            </form>
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
            <Button slot="close" variant="secondary">
              {t("admin.cancel")}
            </Button>
            <Button type="submit" form={FORM_ID} isPending={isLoading} isDisabled={userIds.length === 0}>
              {t("departments.addShort")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
