export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  return (
    <input
      value={value.join(", ")}
      onChange={(event) =>
        onChange(
          event.target.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        )
      }
      placeholder="favorito, cozy, classico"
    />
  );
}
