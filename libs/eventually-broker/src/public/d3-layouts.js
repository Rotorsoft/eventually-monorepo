import * as d3 from "https://cdn.skypack.dev/d3@7";

const R = 36;
const CHAR_W = 6;

const d3_tree = (rootNode, dx) => {
  // horizontal padding for first and last column
  const padding = 1;

  // Compute the layout.
  const width = window.innerHeight;
  const root = d3.hierarchy(rootNode);
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

  const svg = d3
    .create("svg")
    .attr("viewBox", [(-dy * padding) / 2, x0 - dx, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

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

  svg
    .append("g")
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append((d) => d.data.g)
    .attr("transform", (d) => `translate(${d.y},${d.x})`);

  return svg.node();
};

const d3_graph = (nodes, links, cacheKey) => {
  const width = window.innerWidth,
    height = window.innerHeight;

  const clamp = (x, y) => ({
    x: Math.max(R, Math.min(width - R, Math.abs(x))),
    y: Math.max(R, Math.min(height - R, Math.abs(y)))
  });

  if (cacheKey) {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      const _nodes = JSON.parse(cache);
      _nodes.forEach(({ id, x, y }) => {
        const found = nodes.find((n) => n.id === id);
        if (found) {
          found.x = x;
          found.y = y;
          found.fx = x;
          found.fy = y;
        }
      });
    }
  }

  let saving;
  const save = () => {
    if (cacheKey) {
      clearTimeout(saving);
      saving = setTimeout(() => {
        localStorage.setItem(
          cacheKey,
          JSON.stringify(nodes.map(({ id, x, y }) => ({ id, x, y })))
        );
      }, 3000);
    }
  };

  const svg = d3
    .create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  const simulation = d3
    .forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-20))
    .force(
      "link",
      d3.forceLink(links).id((d) => d.id)
    )
    .force("center", d3.forceCenter())
    .alphaMin(0.1)
    .stop();

  const drag = d3
    .drag()
    .on("start", function () {
      d3.select(this).classed("dragging", true);
    })
    .on("drag", function ({ dx, dy }, d) {
      const c = clamp(d.x + dx, d.y + dy);
      d.fx = c.x;
      d.fy = c.y;
      simulation.alpha(0).restart();
    })
    .on("end", function () {
      d3.select(this).classed("dragging", false);
      save();
    });

  const link = svg
    .append("g")
    .selectAll("g")
    .data(links)
    .enter()
    .append((d) => d.g);

  const path = link
    .append("path")
    .attr("id", (d) => `path-${d.id}`)
    .style("stroke", (d) => d.color);

  const dots = link
    .append("text")
    .attr("dy", CHAR_W / 2)
    .append("textPath")
    .attr("xlink:href", (d) => `#path-${d.id}`)
    .text("⬤");

  const node = svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append((d) => d.g)
    .attr("x", (d) => d.x || width / 2)
    .attr("y", (d) => d.y || height / 2)
    .call(drag);

  simulation.on("tick", () => {
    node.attr("transform", (d) => {
      const { x, y } = clamp(d.x, d.y);
      return `translate(${x},${y})`;
    });
    path.attr("d", (d) => {
      const { x: sx, y: sy } = clamp(d.source.x, d.source.y);
      const { x: tx, y: ty } = clamp(d.target.x, d.target.y);
      const r = Math.hypot(tx - sx, ty - sy);
      return `M${sx},${sy}A${r},${r} 0 0,1 ${tx},${ty}`;
    });
    dots.attr("startOffset", (d) => {
      const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
      return r * Math.acos(0.5) - R - CHAR_W * 1.2;
    });
  });

  simulation.alphaTarget(0.3).restart();

  return svg.node();
};

export { d3, d3_tree, d3_graph, R, CHAR_W };
