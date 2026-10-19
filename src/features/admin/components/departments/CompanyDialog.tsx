"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Modal, Spinner, TextField, toast } from "@heroui/react";
import { useGetOrganizationQuery, useUpdateOrganizationMutation, type OrganizationDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";
import "../../api";

const FORM_ID = "company-form";

/** The fields a validation error can be shown under (the form's own camelCase spelling of the server's keys). */
const FORM_FIELDS = ["name", "slogan", "shortName", "foundedOn", "address", "phoneNumber", "email", "website"];

/** Today as the date input spells it (YYYY-MM-DD, local time): the latest founding day the server accepts. */
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Longest company name the server accepts. */
const MAX_NAME = 200;

type Props = {
  /** "create" sets the company up (the server creates its single row on the first save); "edit" changes it. */
  mode: "create" | "edit";
  onClose: () => void;
};

/**
 * The company's details: name (required), slogan, short name, founding date, address, phone, email and website. Both modes send
 * `PUT /api/Organization`; empty optional fields go as null. Create mode starts empty; edit mode reads the company
 * afresh and fills the form from it (Save waits for that). The server's field errors show under the fields and any
 * other refusal in an alert; a save closes the dialog with a toast. The chart refetches by itself (see `../../api`).
 */
export function CompanyDialog({ mode, onClose }: Props) {
  const { t } = useLocale();
  const isEdit = mode === "edit";
  // Edit mode reads the company afresh: a stale copy would overwrite whatever someone else changed since.
  const organization = useGetOrganizationQuery(undefined, { skip: !isEdit, refetchOnMountOrArgChange: true });
  const loaded = !isEdit || (organization.isSuccess && !organization.isFetching);

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container size="lg" placement="center" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("admin.close")} />
          <Modal.Header>
            <Modal.Heading>{t(isEdit ? "departments.company.edit" : "departments.company.create")}</Modal.Heading>
          </Modal.Header>
          {loaded ? (
            <CompanyForm isEdit={isEdit} initial={organization.data} onClose={onClose} />
          ) : (
            <>
              <Modal.Body className="flex flex-col gap-4 p-1">
                {organization.isError ? (
                  <Alert status="danger" role="alert">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{t("departments.company.loadError")}</Alert.Description>
                    </Alert.Content>
                    <Button size="sm" variant="secondary" onPress={() => void organization.refetch()}>
                      {t("admin.retry")}
                    </Button>
                  </Alert>
                ) : (
                  <div className="flex justify-center py-4">
                    <Spinner size="sm" aria-label={t("admin.opening")} />
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t("admin.cancel")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function CompanyForm({ isEdit, initial, onClose }: { isEdit: boolean; initial?: OrganizationDto; onClose: () => void }) {
  const { t } = useLocale();
  const [updateOrganization, { isLoading }] = useUpdateOrganizationMutation();
  const [name, setName] = useState(initial?.name ?? "");
  const [slogan, setSlogan] = useState(initial?.slogan ?? "");
  const [shortName, setShortName] = useState(initial?.shortName ?? "");
  const [foundedOn, setFoundedOn] = useState((initial?.foundedOn ?? "").slice(0, 10));
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    // The browser stops an empty name; spaces alone get past it.
    if (!name.trim()) {
      setFieldErrors({ name: [t("departments.company.nameRequired")] });
      return;
    }
    setFieldErrors({});
    try {
      await updateOrganization({
        updateOrganizationCommand: {
          name: name.trim(),
          slogan: slogan.trim() || null,
          shortName: shortName.trim() || null,
          foundedOn: foundedOn || null,
          address: address.trim() || null,
          phoneNumber: phoneNumber.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
        },
      }).unwrap();
      toast.success(t(isEdit ? "departments.company.saved" : "departments.company.created"));
      onClose();
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, FORM_FIELDS);
      setFieldErrors(found);
      // What no field can show is said as it is; with nothing to say, the server's detail.
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <>
      <Modal.Body className="flex flex-col gap-4 p-1">
        <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
          <TextField name="name" isRequired autoFocus value={name} onChange={setName} maxLength={MAX_NAME} variant="secondary">
            <Label>{t("departments.company.name")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <TextField name="slogan" value={slogan} onChange={setSlogan} maxLength={200} variant="secondary">
            <Label>{t("departments.company.slogan")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="shortName" value={shortName} onChange={setShortName} maxLength={50} variant="secondary">
              <Label>{t("departments.company.shortName")}</Label>
              <Input autoComplete="off" />
              <FieldError />
            </TextField>
            <TextField name="foundedOn" value={foundedOn} onChange={setFoundedOn} variant="secondary">
              <Label>{t("departments.company.foundedOn")}</Label>
              <Input type="date" min="1900-01-01" max={today()} />
              <FieldError />
            </TextField>
          </div>
          <TextField name="address" value={address} onChange={setAddress} maxLength={500} variant="secondary">
            <Label>{t("departments.company.address")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="phoneNumber" type="tel" value={phoneNumber} onChange={setPhoneNumber} maxLength={20} variant="secondary">
              <Label>{t("departments.company.phone")}</Label>
              <Input autoComplete="off" />
              <FieldError />
            </TextField>
            <TextField name="email" value={email} onChange={setEmail} maxLength={256} variant="secondary">
              <Label>{t("departments.company.email")}</Label>
              <Input autoComplete="off" inputMode="email" />
              <FieldError />
            </TextField>
          </div>
          <TextField name="website" value={website} onChange={setWebsite} maxLength={256} variant="secondary">
            <Label>{t("departments.company.website")}</Label>
            <Input autoComplete="off" />
            <FieldError />
          </TextField>
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

      <Modal.Footer>
        <Button slot="close" variant="secondary">
          {t("admin.cancel")}
        </Button>
        <Button type="submit" form={FORM_ID} isPending={isLoading}>
          {t(isEdit ? "departments.company.save" : "departments.company.create")}
        </Button>
      </Modal.Footer>
    </>
  );
}
