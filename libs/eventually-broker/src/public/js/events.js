import { getState } from "/_public/js/utils.js";

//let after
let names;
let stream;
let created_before;
let created_after;
let nextButton;
let queryButton;

function toQueryString(key, values) {
  return values
    .split(",")
    .map((value) => `&${key}=${encodeURIComponent(value.toString().trim())}`)
    .join("");
}

function toISOString(localValueString) {
  return new Date(localValueString).toISOString();
}

function clearField(id) {
  const el = document.getElementById(id);
  el && (el.value = "");
}

function preventDefault(e) {
  e.preventDefault();
  return true;
}

function filter(id) {
  //${after.value && toQueryString("after", after.value)}
  const query = `
    ${names.value && toQueryString("names", names.value)}
    ${stream.value && toQueryString("stream", stream.value)}
    ${
      created_after.value &&
      toQueryString("created_after", toISOString(created_after.value))
    }
    ${
      created_before.value &&
      toQueryString("created_before", toISOString(created_before.value))
    }
    `.replaceAll(" ", "");
  document.location = `/_services/${id}/events?${query}`;
}

function nextFromLast(id, stream) {
  if (stream.length) {
    const before = new Date(stream[stream.length - 1].created);
    const adjusted = new Date(
      before.getTime() - before.getTimezoneOffset() * 60 * 1000
    );
    created_before.value = adjusted.toISOString().substring(0, 16);
    filter(id);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const payload = getState();

  //after = document.getElementById("after");
  names = document.getElementById("names");
  stream = document.getElementById("stream");
  created_before = document.getElementById("created_before");
  created_after = document.getElementById("created_after");
  nextButton = document.getElementById("nextButton");
  queryButton = document.getElementById("queryButton");
  nextButton.disabled = payload.stream.length < 100;

  nextButton.onclick = () => nextFromLast(payload.id, payload.stream);
  queryButton.onclick = () => filter(payload.id);

  const filters = [].slice.call(
    document.querySelectorAll(".input-group input")
  );
  filters.forEach((filter) => {
    const clear = document.createElement("button");
    clear.classList.add("btn", "btn-secondary");
    clear.innerHTML = "<i class='bi bi-x'></i>";
    clear.addEventListener("click", () => clearField(filter.id));
    filter.parentElement.appendChild(clear);
  });

  const list = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]')
  );
  list.forEach((el) => {
    el.addEventListener("click", preventDefault);
    const event = payload.stream[el.id];
    const opts = {
      title: `${event.id} ${event.name}`,
      content: JSON.stringify(event.data),
      html: true,
      trigger: "focus"
    };
    new bootstrap.Popover(el, opts);
  });
});
