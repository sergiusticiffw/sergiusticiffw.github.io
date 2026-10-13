function line(label: string, value: string | null) {
  const text = value?.trim();
  return text ? `${label}: ${text}` : "";
}

export function documentBody(input: {
  extractedText: string | null;
  consultation: {
    doctor_name: string | null;
    clinic_name: string | null;
    specialty: string | null;
    summary: string | null;
    recommendations: string | null;
  } | null;
  labs: {
    test_name: string;
    result_value: number | string | null;
    result_text: string | null;
    unit: string | null;
    reference_text: string | null;
    laboratory: string | null;
  }[];
}) {
  if (input.extractedText?.trim()) {
    return input.extractedText.trim();
  }

  const sections: string[] = [];
  if (input.consultation) {
    sections.push(
      [
        "Consultație",
        line("Medic", input.consultation.doctor_name),
        line("Clinică", input.consultation.clinic_name),
        line("Specialitate", input.consultation.specialty),
        line("Rezumat", input.consultation.summary),
        line("Recomandări", input.consultation.recommendations),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (input.labs.length > 0) {
    sections.push(
      [
        "Analize",
        ...input.labs.map((row) => {
          const result = [
            row.result_text ??
              (row.result_value === null || row.result_value === undefined
                ? ""
                : String(row.result_value)),
            row.unit ?? "",
          ]
            .map((value) => value.trim())
            .filter(Boolean)
            .join(" ");
          const headline = result ? `${row.test_name} — ${result}` : row.test_name;
          const details = [
            row.reference_text?.trim() ? `Interval: ${row.reference_text.trim()}` : "",
            row.laboratory?.trim() ? `Laborator: ${row.laboratory.trim()}` : "",
          ].filter(Boolean);
          return [headline, ...details.map((detail) => `  ${detail}`)].join("\n");
        }),
      ].join("\n\n"),
    );
  }

  return sections.join("\n\n");
}
