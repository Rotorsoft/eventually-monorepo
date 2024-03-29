import { getState } from "/public/js/utils.js";
import { d3, d3_graph, R, CHAR_W } from "/public/js/d3-layouts.js";

const MAXL = Math.round((2 * R) / CHAR_W) - 1;
const usnf = new Intl.NumberFormat("en-US");

const COLORS = {
  secondary: "#c0c0c0",
  success: "#198754",
  warning: "#ffc107",
  danger: "#dc3545"
};

const node_color = (service) =>
  service.discovered
    ? Object.keys(service.eventHandlers).length
      ? "#ffc107"
      : Object.keys(service.commandHandlers).length
      ? "#8ab2f2"
      : (service.producers || 0) === 0
      ? "pink"
      : "white"
    : "white";

const link_color = (row) =>
  COLORS[row.active ? row.endpointStatus.color : "secondary"];

document.addEventListener("DOMContentLoaded", function () {
  const { services, rows } = getState();

  const nodes = services.map((n) => {
    const g = d3.create("svg:g").attr("id", `g-${n.id}`);
    g.append("circle")
      .attr("id", `node-${n.id}`)
      .attr("r", R)
      .style("fill", node_color(n));
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", CHAR_W / 2)
      .text(n.id.length <= MAXL ? n.id : n.id.substring(0, MAXL) + "\u22ef");
    g.append("text")
      .attr("id", `version-${n.id}`)
      .attr("text-anchor", "middle")
      .attr("y", CHAR_W * 2)
      .text(n.version);
    g.append("text")
      .attr("id", `label-${n.id}`)
      .attr("text-anchor", "middle")
      .attr("y", -R + CHAR_W * 2)
      .text(n.label);
    n.g = g.node();
    return n;
  });

  const links = rows.map((row) => {
    const consumer = services.find((s) => s.id === row.consumer);
    consumer && (consumer.producers = (consumer.producers || 0) + 1);
    const link = {
      id: row.id,
      source: row.producer,
      target: row.consumer,
      color: link_color(row)
    };
    const g = d3
      .create("svg:g")
      .attr("id", `link-${link.id}`)
      .style("fill", link.color)
      .attr("class", "link");
    g.append("text")
      .attr("dy", CHAR_W / 2)
      .append("textPath")
      .attr("id", `last-event-${link.id}`)
      .attr("xlink:href", `#path-${link.id}`);
    g.append("text")
      .attr("dy", CHAR_W + 2)
      .append("textPath")
      .attr("id", `position-${link.id}`)
      .attr("xlink:href", `#path-${link.id}`)
      .attr("startOffset", R + 3)
      .text(usnf.format(row.position));
    g.append("text")
      .attr("dy", -CHAR_W / 2)
      .append("textPath")
      .attr("xlink:href", `#path-${link.id}`)
      .attr("startOffset", "50%")
      .style("font-size", "8")
      .style("fill", "silver")
      .text(row.path);
    link.g = g.node();
    return link;
  });

  const animate_node = async ({ id, discovered, version, label, color }) => {
    d3.select(`#version-${id}`).text(version);
    d3.select(`#label-${id}`).text(label);
    d3.select(`#node-${id}`)
      .style("stroke", discovered ? "green" : "#6c757d")
      .interrupt()
      .style("fill", "white")
      .transition()
      .duration(2000)
      .style("fill", color);
  };

  const animate_link = async ({ id, position, endpointStatus, color }) => {
    d3.select(`#path-${id}`).style("stroke", color);
    d3.select(`#link-${id}`).style("fill", color);
    d3.select(`#position-${id}`)
      .text(usnf.format(position))
      .interrupt()
      .style("font-size", "120%")
      .transition()
      .duration(2000)
      .style("font-size", "100%");
    d3.select(`#last-event-${id}`)
      .text(endpointStatus.name && "⬤")
      .interrupt()
      .attr("startOffset", "0%")
      .transition()
      .duration(2000)
      .attr("startOffset", "100%");
  };

  const connect = () => {
    const es = new EventSource("/monitor");
    es.addEventListener("state", ({ data }) => {
      const state = JSON.parse(data);
      state.color = link_color(state);
      animate_link(state);
    });
    es.addEventListener("health", ({ data }) => {
      const service = JSON.parse(data);
      service.color = node_color(service);
      animate_node(service);
    });
    es.onerror = (error) => {
      console.error("sse error... retrying...");
    };
  };

  if (services.length) {
    d3_graph("container", nodes, links, "cache-graph");
    connect();
  }
});
