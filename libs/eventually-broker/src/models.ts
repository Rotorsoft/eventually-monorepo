import { Actor } from "@rotorsoft/eventually";
import { state, SubscriptionViewModel } from "./cluster";
import { Subscription } from "./types";

export const toViewState = (
  req: { user?: Actor },
  state: Record<string, unknown>
): Record<string, unknown> => {
  const isAdmin = req.user && req.user?.roles?.includes("admin");
  return Object.assign({}, state, { user: req.user, isAdmin });
};

/**
 * Prepare sorted subscriptions view model
 * @param subs subscriptions
 * @returns view model
 */
export const toSubscriptionsView = (
  subs: Subscription[]
): { rows: SubscriptionViewModel[] } => ({
  rows: subs
    .map((sub) => ({
      ...state().viewModel(sub),
      ...sub,
      pll: state().serviceLogLink(sub.producer),
      cll: state().serviceLogLink(sub.consumer)
    }))
    .sort((a, b) =>
      a.active < b.active
        ? 1
        : a.active > b.active
          ? -1
          : b.total - a.total
            ? b.total - a.total
            : b.position - a.position
    )
});
