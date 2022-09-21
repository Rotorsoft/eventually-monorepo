import { sort_table } from "/_public/js/sort-table.js";

function preventDefault(e) {
  e.preventDefault();
  return true;
}

document.addEventListener("DOMContentLoaded", function () {
  sort_table("events-table", [0]);

  const list = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]')
  );
  list.map((el) => {
    el.addEventListener("click", preventDefault);
    const payload = document.getElementById(el.id.concat("-payload"));
    const opts = {
      title: el.id,
      content: payload.innerHTML,
      html: true,
      trigger: "focus"
    };
    new bootstrap.Popover(el, opts);
  });
});
