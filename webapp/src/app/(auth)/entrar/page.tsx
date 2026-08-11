import { Suspense } from "react";
import { FormEntrar } from "./FormEntrar";

export default function EntrarPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Suspense>
        <FormEntrar />
      </Suspense>
    </main>
  );
}
