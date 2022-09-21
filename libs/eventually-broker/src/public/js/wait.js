import { getState, wait } from "/_public/js/utils.js";

document.addEventListener("DOMContentLoaded", function () {
  const state = getState();
  wait(state.id);
});
