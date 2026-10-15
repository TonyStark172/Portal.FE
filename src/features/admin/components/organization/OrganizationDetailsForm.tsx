"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, FieldError, Form, Input, Label, Skeleton, TextField, toast } from "@heroui/react";
import { useGetOrganizationQuery, useUpdateOrganizationMutation, type OrganizationDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { splitValidationErrors } from "../../lib/validationErrors";

const FIELDS = ["name", "shortName", "foundedOn", "address", "phoneNumber", "email", "website"] as const;
type Field = (typeof FIELDS)[number];
const LABELS: Record<Field, string> = {
  name: "admin.organizationName", shortName: "admin.organizationShortName", foundedOn: "admin.organizationFoundedOn",
  address: "admin.organizationAddress",
  phoneNumber: "admin.organizationPhone", email: "admin.organizationEmail", website: "admin.organizationWebsite",
};
const TYPES: Partial<Record<Field, string>> = { foundedOn: "date", phoneNumber: "tel", email: "email", website: "url" };
/**
 * Where each field sits on a wide screen, three columns to a row: the name (two) beside its short form (one); the
 * founding date (one) beside the address (two); then phone, email and website. Narrower screens keep two columns.
 */
const SPANS: Partial<Record<Field, string>> = {
  name: "sm:col-span-2 lg:col-span-2",
  address: "sm:col-span-2 lg:col-span-2",
  website: "sm:col-span-2 lg:col-span-1",
};

/**
 * The organization's details: its name (required) and how to reach it (all optional). The part's title is the page's
 * (SettingsSection); this is only the form.
 */
export function OrganizationDetailsForm() {
  const { t } = useLocale();
  const organization = useGetOrganizationQuery();

  if (organization.isError) {
    return (
      <Alert status="danger" role="alert">
        <Alert.Indicator />
        <Alert.Content><Alert.Description>{t("admin.organizationLoadError")}</Alert.Description></Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => organization.refetch()}>{t("admin.retry")}</Button>
      </Alert>
    );
  }
  return organization.data ? <DetailsForm organization={organization.data} /> : <Skeleton className="h-48 rounded-xl" />;
}

function DetailsForm({ organization }: { organization: OrganizationDto }) {
  const { t } = useLocale();
  const [updateOrganization, { isLoading }] = useUpdateOrganizationMutation();
  const [values, setValues] = useState<Record<Field, string>>(() =>
    Object.fromEntries(FIELDS.map((field) => [field, organization[field] ?? ""])) as Record<Field, string>);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);
    const optional = (field: Field) => values[field].trim() || null;
    try {
      await updateOrganization({
        updateOrganizationCommand: {
          name: values.name.trim(), shortName: optional("shortName"), address: optional("address"),
          phoneNumber: optional("phoneNumber"), email: optional("email"), website: optional("website"),
          foundedOn: optional("foundedOn"),
        },
      }).unwrap();
      toast.success(t("admin.organizationSaved"));
    } catch (failure) {
      const problem = toApiProblem(failure);
      const { fieldErrors: found, leftover } = splitValidationErrors(problem, FIELDS);
      setFieldErrors(found);
      if (leftover.length > 0) setError(leftover.join(" "));
      else if (Object.keys(found).length === 0) setError(problem.detail ?? t("common.genericError"));
    }
  }

  return (
    <Form className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <TextField key={field} name={field} isRequired={field === "name"} value={values[field]} variant="secondary"
            className={SPANS[field]}
            onChange={(value) => setValues((current) => ({ ...current, [field]: value }))}>
            <Label>{t(LABELS[field])}</Label>
            <Input type={TYPES[field] ?? "text"} />
            <FieldError />
          </TextField>
        ))}
      </div>
      {error && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
        </Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" isPending={isLoading}>{t("admin.saveOrganization")}</Button>
      </div>
    </Form>
  );
}
