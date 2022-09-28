import { getState, wait } from "/public/js/utils.js";

document.addEventListener("DOMContentLoaded", function () {
  const state = getState();
  wait(state.id);
});
