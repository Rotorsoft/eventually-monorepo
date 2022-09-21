import { getState } from "/_public/js/utils.js";
import { sort_table } from "/_public/js/sort-table.js";

const usnf = new Intl.NumberFormat("en-US");

const badge = (count, cls) =>
  count > 0 ? `<span class="${cls}">${usnf.format(count)}</span>` : "";

const refresh = (state) => {
  const { id, active, position, channelPosition, endpointStatus, events } =
    state;

  const rowTr = document.getElementById(`row-${id}`);
  rowTr &&
    (active
      ? rowTr.classList.remove("table-secondary")
      : rowTr.classList.add("table-secondary"));

  const statusTd = document.getElementById(`status-${id}`);
  statusTd &&
    (statusTd.innerHTML = `<i class="bi ${endpointStatus.icon} text-${endpointStatus.color}"></i>&nbsp;<a href="/${id}">${id}</a>`);

  const positionSpan =
    position < channelPosition
      ? `${usnf.format(position)} /${usnf.format(channelPosition)}`
      : usnf.format(position);
  const positionTd = document.getElementById(`position-${id}`);
  positionTd &&
    (positionTd.innerHTML = `
      <div class="text-${endpointStatus.color}">
        ${positionSpan}
      </div>`);

  const a = events.reduce(
    (a, e) => {
      a.ok += e.ok ? e.ok.count : 0;
      a.ignored += e.ignored ? e.ignored.count : 0;
      a.retryable += e.retryable ? e.retryable.count : 0;
      a.critical += e.critical ? e.critical.count : 0;
      return a;
    },
    { ok: 0, ignored: 0, retryable: 0, critical: 0 }
  );

  const sessionTd = document.getElementById(`session-${id}`);
  sessionTd &&
    (sessionTd.innerHTML = `
      <div class="counters">
        ${badge(a.ok, "ok")}
        ${badge(a.ignored, "ignored")}
        ${badge(a.retryable, "retryable")}
        ${badge(a.critical, "critical")}
      </div>`);
};

const connect = () => {
  const es = new EventSource("/_monitor-all");
  es.addEventListener("state", ({ data }) => {
    const state = JSON.parse(data);
    refresh(state);
  });
  es.onerror = (error) => {
    console.error("sse error... retrying...");
  };
};

document.addEventListener("DOMContentLoaded", function () {
  sort_table("subs-table", [1, 2]);
  const rows = getState();
  rows.map((row) => refresh(row));
  connect();
});
