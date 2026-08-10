import { notFound } from "next/navigation";
import { DevUiShowcase } from "./DevUiShowcase";

export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DevUiShowcase />;
}
