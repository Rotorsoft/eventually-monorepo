import { getState } from "/public/js/utils.js";

const usnf = new Intl.NumberFormat("en-US");

let delId;
let delBtn;
let statusInput;
let positionInput;
let triggerInput;
let statsDiv;

const renderStats = (stats, color) =>
  stats && stats.count
    ? `
    <th class="text-end table-${color}">${usnf.format(stats.count)}</th>
    <td class="text-end table-${color} stat">${usnf.format(stats.min)}</td>
    <td class="text-end table-${color} stat">${usnf.format(stats.max)}</td>
  `
    : "<td/><td/><td/>";

const refresh = ({
  id,
  active,
  position,
  channelPosition,
  channelStatus,
  endpointStatus,
  events
}) => {
  const _events = (events || [])
    .map(({ name, found, ok, ignored, retryable, critical }) => {
      return `
        <tr>
          ${found ? `<th>${name}</th>` : `<td>${name}</td>`}
          ${renderStats(ok, "success")}
          ${renderStats(retryable, "warning")}
          ${renderStats(critical, "danger")}
          ${renderStats(ignored, "secondary")}
        </tr>
      `;
    })
    .join("");

  const status = channelStatus || (active ? "Running" : "Inactive");
  const refreshBtn =
    delBtn && active
      ? `<a href="/command/refresh/${id}" title="Refresh"
          type="button"
          class="btn btn-lg p-0"><i class="bi bi-arrow-repeat text-primary"></i>
        </a>`
      : "";

  statusInput.value = status;
  positionInput.value = usnf.format(position);
  triggerInput.value = usnf.format(channelPosition) || "";

  const toggleIcon = active ? "bi-toggle-on" : "bi-toggle-off";
  const toggleTitle = active ? "Stop" : "Start";
  const toggleButton =
    delBtn && endpointStatus
      ? `<a href="/command/toggle/${id}" title=${toggleTitle}
        type="button"
        class="btn btn-lg p-0"><i class="bi ${toggleIcon} text-${endpointStatus.color}"></i>
      </a>`
      : "";
  const errorBlock =
    endpointStatus && endpointStatus.error
      ? `<div class="error-block">
      <span>${endpointStatus.error.trigger || ""}</span><br/>
      <i>
        <b>${
          (endpointStatus.name &&
            endpointStatus.name.concat(
              " ",
              usnf.format(endpointStatus.error.position)
            )) ||
          ""
        }</b>
        <ul>${endpointStatus.error.messages
          .map((m) => `<li>${m}</li>`)
          .join("")}</ul>
      </i>
    </div>`
      : "";

  endpointStatus &&
    (statsDiv.innerHTML = `
    <div class="card p-0">
      <div class="card-header row p-2 m-0">
        <h6 class="card-title m-0 col-11">
          ${toggleButton}<b> ${endpointStatus.code || ""} ${
      endpointStatus.status || ""
    }</b>
          ${errorBlock}
        </h6> 
        <div class="col-1 text-end">
          ${refreshBtn}
        </div>
      </div>
      <div class="card-body">
        <table class="table align-middle table-hover">
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col" colspan="3" class="same-width text-center table-success">Ok</th>
              <th scope="col" colspan="3" class="same-width text-center table-warning">Retryable</th>
              <th scope="col" colspan="3" class="same-width text-center table-danger">Critical</th>
              <th scope="col" colspan="3" class="same-width text-center table-secondary">Ignored</th>
            </tr>
            <tr>
              <th/>
              <th class="text-end table-success">Count</th>
              <th class="text-end table-success stat">Min</th>
              <th class="text-end table-success stat">Max</th>
              <th class="text-end table-warning">Count</th>
              <th class="text-end table-warning stat">Min</th>
              <th class="text-end table-warning stat">Max</th>
              <th class="text-end table-danger">Count</th>
              <th class="text-end table-danger stat">Min</th>
              <th class="text-end table-danger stat">Max</th>
              <th class="text-end table-secondary">Count</th>
              <th class="text-end table-secondary stat">Min</th>
              <th class="text-end table-secondary stat">Max</th>
            </tr>
          </thead>
          <tbody>
            ${_events}
          </tbody>
        </table>
      </div>
    </div>`);
};

const connect = (sub) => {
  const es = new EventSource(`/monitor/${sub.id}`);
  es.addEventListener("state", ({ data }) => {
    const state = JSON.parse(data);
    refresh(state);
  });
};

document.addEventListener("DOMContentLoaded", function () {
  const sub = getState();

  delId = document.getElementById("deleteId");
  delBtn = document.getElementById("deleteButton");
  if (delId && delBtn) {
    delId.onkeyup = () => {
      const enable = delId.value === sub.id;
      enable
        ? delBtn.classList.remove("disabled")
        : delBtn.classList.add("disabled");
    };
    delBtn.onclick = () => {
      fetch(`/subscriptions/${sub.id}`, { method: "delete" })
        .then((response) => response.json())
        .then((json) => {
          if (json.deleted) document.location = "/subscriptions";
          else {
            delId.value = "";
            alert(json.message);
          }
        })
        .catch(() => {
          delId.value = "";
          alert(json.message);
        });
    };
  }

  statusInput = document.getElementById("floatingStatus");
  positionInput = document.getElementById("floatingPosition");
  triggerInput = document.getElementById("floatingChannelPosition");
  statsDiv = document.getElementById("stats");

  refresh(sub);
  connect(sub);
});
