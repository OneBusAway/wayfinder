import type { IStaticMethods } from "preline/dist";

declare global {
  interface Window {
    // Optional plugins
    _;
    $: typeof import("jquery");
    jQuery: typeof import("jquery");
    DataTable;
    Dropzone;
    VanillaCalendarPro;

    // Preline UI
    HSStaticMethods: IStaticMethods;
  }

  namespace App {
    ...
  }
}

export {};