import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { INPUT_CLASS } from "../../components/Field";
import { cx } from "../../lib/cx";
import { formatCents } from "../../lib/format";
import type { DraftItemForm } from "../../lib/validation";
import { emptyItem, lineTotalCents } from "./draftForm";

interface DraftItemsEditorProps {
  items: DraftItemForm[];
  onChange: (items: DraftItemForm[]) => void;
  error?: string;
  disabled: boolean;
}

type EditableField = "name" | "quantity" | "unit_price";

export function DraftItemsEditor({ items, onChange, error, disabled }: DraftItemsEditorProps) {
  const updateItem = (key: string, field: EditableField, value: string) => {
    onChange(items.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };
  const removeItem = (key: string) => onChange(items.filter((item) => item.key !== key));

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink">Line items</legend>
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 @lg:grid-cols-[1fr_4.5rem_7rem_5.5rem_auto]"
          >
            <input
              aria-label={`Item ${index + 1} description`}
              placeholder="Description"
              value={item.name}
              onChange={(event) => updateItem(item.key, "name", event.target.value)}
              className={cx(INPUT_CLASS, "col-span-3 @lg:col-span-1")}
            />
            <input
              aria-label={`Item ${index + 1} quantity`}
              inputMode="decimal"
              placeholder="Qty"
              value={item.quantity}
              onChange={(event) => updateItem(item.key, "quantity", event.target.value)}
              className={cx(INPUT_CLASS, "money text-right")}
            />
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">
                $
              </span>
              <input
                aria-label={`Item ${index + 1} unit price in US dollars`}
                inputMode="decimal"
                placeholder="0.00"
                value={item.unit_price}
                onChange={(event) => updateItem(item.key, "unit_price", event.target.value)}
                className={cx(INPUT_CLASS, "money pl-6 text-right")}
              />
            </div>
            <span className="money hidden text-right text-sm text-ink-soft @lg:block">
              {formatCents(lineTotalCents(item))}
            </span>
            <button
              type="button"
              onClick={() => removeItem(item.key)}
              aria-label={`Remove item ${index + 1}`}
              className="rounded-md p-2 text-muted hover:bg-paper-deep hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => onChange([...items, emptyItem()])}
        >
          Add line item
        </Button>
      </div>
    </fieldset>
  );
}
