import { Rating } from "../types";

const ratingOptions = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as Rating[];

export function RatingInput({
  value,
  onChange,
}: {
  value?: Rating;
  onChange: (rating: Rating | undefined) => void;
}) {
  return (
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value ? (Number(event.target.value) as Rating) : undefined)}>
      <option value="">Sem nota</option>
      {ratingOptions.map((rating) => (
        <option key={rating} value={rating}>
          {rating}
        </option>
      ))}
    </select>
  );
}

export function Stars({ value = 0 }: { value?: number }) {
  const stars = Array.from({ length: 5 }, (_, index) => {
    const amount = Math.max(0, Math.min(1, value - index));
    return amount >= 1 ? "★" : amount >= 0.5 ? "★" : "☆";
  });

  return (
    <span className="stars" title={value ? `${value}/5` : "Sem nota"}>
      {stars.map((star, index) => (
        <span key={index} className={value - index === 0.5 ? "half-star" : ""}>
          {star}
        </span>
      ))}
    </span>
  );
}
