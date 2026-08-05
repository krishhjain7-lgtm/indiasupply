"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Modal from "./modal";
import RfqForm from "./rfq-form";
import ManufacturerForm from "./manufacturer-form";

type Dialog = "rfq" | "manufacturer" | "signin" | null;

const CtaContext = createContext<{
  open: (d: Exclude<Dialog, null>) => void;
}>({ open: () => {} });

export function useCta() {
  return useContext(CtaContext);
}

export function CtaProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = useCallback(() => setDialog(null), []);
  const value = useMemo(
    () => ({ open: (d: Exclude<Dialog, null>) => setDialog(d) }),
    [],
  );

  return (
    <CtaContext.Provider value={value}>
      {children}

      <Modal open={dialog === "rfq"} onClose={close} labelledBy="rfq-title">
        <RfqForm onClose={close} />
      </Modal>

      <Modal
        open={dialog === "manufacturer"}
        onClose={close}
        labelledBy="mfr-title"
      >
        <ManufacturerForm onClose={close} />
      </Modal>

      <Modal
        open={dialog === "signin"}
        onClose={close}
        labelledBy="signin-title"
        width="max-w-[460px]"
      >
        <div className="px-6 py-10 text-center sm:px-9">
          <h2
            id="signin-title"
            className="text-xl font-semibold tracking-[-0.025em]"
          >
            Buyer workspaces open with your first order
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            Norvian provisions your workspace — quotations, sample approvals,
            locked specifications and inspection reports — once a sourcing
            request is accepted. There is nothing to sign up for before that.
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDialog("rfq")}
            >
              Start Sourcing
            </button>
            <button type="button" className="btn btn-secondary" onClick={close}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </CtaContext.Provider>
  );
}

/** Any button on the page that opens one of the three dialogs. */
export function CtaButton({
  dialog,
  className,
  children,
}: {
  dialog: Exclude<Dialog, null>;
  className: string;
  children: React.ReactNode;
}) {
  const { open } = useCta();
  return (
    <button type="button" className={className} onClick={() => open(dialog)}>
      {children}
    </button>
  );
}
