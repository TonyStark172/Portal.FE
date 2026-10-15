"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { Alert, Button, ComboBox, FieldError, Form, Input, Label, ListBox, Modal, TextField } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { portalApi, useGetUsersQuery, useHandOverAdministrationMutation } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { reloadPage } from "../../lib/reload";
import { splitValidationErrors } from "../../lib/validationErrors";

const FORM_ID = "hand-over-form";
/** How many people the recipient search shows at once. */
const SUGGESTIONS = 20;

/**
 * Hands administration over: the administrator picks another person who still works here and confirms with their own
 * password. Once done they are an ordinary user (with the default role), so the app is opened afresh. A wrong password
 * shows under its field; any other refusal in an alert.
 */
export function HandOverDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const { user } = useCurrentUser();
  const [handOver, { isLoading }] = useHandOverAdministrationMutation();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const users = useGetUsersQuery({ search: search || undefined, isActive: true, pageSize: SUGGESTIONS });
  // Never oneself: the administrator already holds the role.
  const candidates = (users.data?.items ?? []).filter((candidate) => candidate.id !== user?.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recipientId === null) return;
    setFieldErrors({});
    setError(null);
    try {
      await handOver({ handOverAdministrationCommand: { recipientId, password } }).unwrap();
      // Whatever was read as the administrator no longer holds.
      dispatch(portalApi.util.resetApiState());
      reloadPage();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, ["password"]);
      setFieldErrors(found);
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen isDismissable={!isLoading} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} isDisabled={isLoading} />
          <Modal.Header className="pe-8">
            <Modal.Heading>{t("admin.handOver")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4 p-1">
            <p className="text-sm text-muted">{t("admin.handOverExplained")}</p>
            <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
              <ComboBox fullWidth variant="secondary" isRequired menuTrigger="input" allowsEmptyCollection
                items={candidates} inputValue={query} defaultFilter={() => true}
                selectedKey={recipientId === null ? null : String(recipientId)}
                onInputChange={(text) => { setQuery(text); if (recipientId !== null && text !== candidates.find((c) => c.id === recipientId)?.fullName) setRecipientId(null); }}
                onSelectionChange={(key) => {
                  const chosen = candidates.find((candidate) => String(candidate.id) === String(key));
                  setRecipientId(chosen?.id ?? null);
                  if (chosen) setQuery(chosen.fullName);
                }}>
                <Label>{t("admin.recipient")}</Label>
                <ComboBox.InputGroup>
                  <Input placeholder={t("admin.recipientPlaceholder")} />
                  <ComboBox.Trigger aria-label={t("admin.showPeople")} />
                </ComboBox.InputGroup>
                <ComboBox.Popover>
                  <ListBox renderEmptyState={() => <p className="p-3 text-sm text-muted">{t("admin.noUsers")}</p>}>
                    {candidates.map((candidate) => (
                      <ListBox.Item key={candidate.id} id={String(candidate.id)} textValue={candidate.fullName}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{candidate.fullName}</span>
                          <span className="truncate text-xs text-muted">@{candidate.userName}</span>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </ComboBox.Popover>
              </ComboBox>
              <TextField name="password" type="password" isRequired value={password} onChange={setPassword} variant="secondary" autoComplete="current-password">
                <Label>{t("admin.yourPassword")}</Label>
                <Input />
                <FieldError />
              </TextField>
            </Form>
            {error && (
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary" isDisabled={isLoading}>{t("admin.cancel")}</Button>
            <Button type="submit" form={FORM_ID} variant="danger" isPending={isLoading} isDisabled={recipientId === null || !password}>
              {t("admin.handOverConfirm")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
