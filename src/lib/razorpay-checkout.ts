export type RazorpaySuccessPayload = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: Record<string, string>;
  };
};

type RazorpayCheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySuccessPayload) => void;
};

interface RazorpayInstance {
  open(): void;
  on(eventName: "payment.failed", handler: (response: RazorpayFailureResponse) => void): void;
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout can only be opened in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-razorpay-checkout="true"]',
      );

      if (existing) {
        if (window.Razorpay) {
          resolve();
          return;
        }

        existing.addEventListener(
          "load",
          () => resolve(),
          { once: true },
        );
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Razorpay checkout.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.defer = true;
      script.dataset.razorpayCheckout = "true";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Razorpay checkout."));
      document.head.appendChild(script);
    }).catch((error) => {
      razorpayScriptPromise = null;
      throw error;
    });
  }

  return razorpayScriptPromise;
}

export type OpenRazorpayCheckoutOptions = {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
};

export async function openRazorpayCheckout(
  options: OpenRazorpayCheckoutOptions,
): Promise<RazorpaySuccessPayload | null> {
  if (typeof window === "undefined") {
    throw new Error("Razorpay checkout can only be opened in the browser.");
  }

  await loadRazorpayScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    throw new Error("Razorpay checkout is unavailable.");
  }

  return new Promise<RazorpaySuccessPayload | null>((resolve, reject) => {
    const checkout = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amountInPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      image: options.image,
      prefill: options.prefill,
      notes: options.notes,
      theme: {
        color: options.themeColor ?? "#6d28d9",
      },
      modal: {
        ondismiss: () => resolve(null),
      },
      handler: (response) => resolve(response),
    });

    checkout.on("payment.failed", (response) => {
      reject(
        new Error(
          response.error?.description ??
            response.error?.reason ??
            "Payment failed.",
        ),
      );
    });

    checkout.open();
  });
}
