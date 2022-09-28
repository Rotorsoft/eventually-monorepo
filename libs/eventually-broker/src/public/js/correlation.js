import { getState } from "/public/js/utils.js";
import { d3, d3_tree, CHAR_W } from "/public/js/d3-layouts.js";

document.addEventListener("DOMContentLoaded", function () {
  const correlation = getState();
  const nodes = {};

  const dx = 120;
  const g = (type, name, service, stream, id, created) => {
    const w =
      2 +
      Math.max(
        name.length,
        (service && service.length) || 0,
        (stream && stream.length) || 0
      );
    const g = d3.create("svg:g");
    g.append("rect")
      .attr("class", type)
      .attr("x", -(w * CHAR_W) / 2)
      .attr("width", w * CHAR_W)
      .attr("rx", 15)
      .attr("y", -(dx / 4))
      .attr("height", dx / 2);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-weight", "bold")
      .html(
        id ? `<a href="/services/${service}/events/${id}">${name}</a>` : name
      );
    service &&
      g
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", -CHAR_W * 3)
        .text(service);
    stream &&
      g
        .append("text")
        .attr("text-anchor", "middle")
        .attr("font-style", "italic")
        .attr("y", CHAR_W * 3)
        .html(`<a href="/services/${service}/stream/${stream}">${stream}</a>`);
    created &&
      g
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", -CHAR_W * 6)
        .text(
          `${created.substring(5, 10).replace("-", "/")} ${created.substring(
            12,
            23
          )}`
        );
    return g.node();
  };

  let root;
  const events = correlation.map(
    ({ service, stream, id, name, created, type, causation }) => {
      const parent_id = causation
        ? `${causation.name}/${causation.id || ""}`
        : `${name}/${id}`;
      const child_id = `${name}/${id}`;
      const parent = (nodes[parent_id] = nodes[parent_id] || {
        name: parent_id,
        children: [],
        type: causation ? causation.type : "command"
      });
      const child = (nodes[child_id] = nodes[child_id] || {
        name: child_id,
        children: []
      });
      child.parent = parent;
      parent.children.push(child);
      child.g = g(
        "event",
        name,
        service,
        stream,
        id,
        new Date(created).toISOString()
      );
      if (!root && causation && causation.name) {
        root = parent;
        root.g = g(
          root.type,
          causation.name,
          causation.service,
          causation.stream,
          causation.id
        );
      }
      return child;
    }
  );

  d3_tree("container", root || events[0], dx);
});
