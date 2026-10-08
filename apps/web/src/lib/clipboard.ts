import { toast } from "sonner";

/** Copy text and confirm with a toast; explains what to do if the browser refuses. */
export function copyToClipboard(text: string, what = "Link") {
  if (!navigator.clipboard) {
    toast.error("Couldn't copy. Select the text and copy it instead.");
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Couldn't copy. Select the text and copy it instead.")
  );
}
