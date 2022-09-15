const d3_tree = (containerId, data) => {
  const CHAR_W = 6;

  // horizontal padding for first and last column
  const padding = 1;

  const container = d3.select(`div#${containerId}`);
  if (!container) return;
  const width = window.innerHeight;
  const svg = container.append("svg");
  const root = d3.hierarchy(data);

  // Compute the layout.
  const dx = 100;
  const dy = width / (root.height + padding);
  d3.tree().nodeSize([dx, dy])(root);

  // Center the tree.
  let x0 = Infinity;
  let x1 = -x0;
  root.each((d) => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  // Compute the default height.
  const height = x1 - x0 + dx * 2;

  svg
    .attr("viewBox", [(-dy * padding) / 2, x0 - dx, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;")
    .attr("font-size", 10);

  svg
    .append("g")
    .attr("class", "tree-link")
    .selectAll("path")
    .data(root.links())
    .join("path")
    .attr(
      "d",
      d3
        .linkHorizontal()
        .x((d) => d.y)
        .y((d) => d.x)
    );

  const node = svg
    .append("g")
    .selectAll("a")
    .data(root.descendants())
    .join("a")
    .attr("transform", (d) => `translate(${d.y},${d.x})`);

  const dl = (d) =>
    Math.max(
      d.label.length,
      (d.header && d.header.length) || 0,
      (d.footer && d.footer.length) || 0
    );

  node
    .append("rect")
    .attr("class", (d) => d.data.type)
    .attr("x", (d) => -(dl(d.data) * CHAR_W) / 2)
    .attr("y", -(dx / 4))
    .attr("width", (d) => dl(d.data) * CHAR_W)
    .attr("height", dx / 2)
    .attr("rx", 15);

  node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .text((d) => d.data.label);

  node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("y", -CHAR_W * 2)
    .text((d) => d.data.header);

  node
    .append("text")
    .attr("text-anchor", "middle")
    .attr("font-style", "italic")
    .attr("y", CHAR_W * 2)
    .text((d) => d.data.footer);

  return svg.node();
};
