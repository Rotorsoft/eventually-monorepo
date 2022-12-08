import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const R = 36;
const CHAR_W = 6;
const MARGIN_X = 20;
const MARGIN_BOTTOM = 150;

const debounce = (func, timeout = 100) => {
  func.__debouncing__ && clearTimeout(func.__debouncing__);
  func.__debouncing__ = setTimeout(func, timeout);
};

let width = window.innerWidth - MARGIN_X;
let height = window.innerHeight - MARGIN_BOTTOM;
let scale = 1;
let panX = 0;
let panY = 0;

const resize = () => {
  width = window.innerWidth - MARGIN_X;
  height = window.innerHeight - MARGIN_BOTTOM;
  d3.select("svg").attr("width", width).attr("height", height);
};
window.onresize = () => debounce(resize);

const d3_tree = (containerId, rootNode, dx) => {
  // horizontal padding for first and last column
  const padding = 1;
  const container = document.getElementById(containerId);
  const ccw = container.clientWidth;

  // Compute the layout.
  const root = d3.hierarchy(rootNode);
  const dy = ccw / (root.height + padding);
  d3.tree().nodeSize([dx, dy])(root);

  root.each((d) => {
    d.x += dx;
    d.y += 30 + (rootNode.name.length * CHAR_W) / 2;
  });

  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 10])
    .on("zoom", function (e) {
      d3.selectAll("svg > g").attr("transform", e.transform);
    });

  const svg = d3.create("svg").attr("height", height).call(zoom);
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

  container.appendChild(svg.node());
};

const d3_graph = (containerId, nodes, links, cacheKey) => {
  const container = document.getElementById(containerId);

  nodes.forEach((n, index) => {
    n.x = n.y = R * index;
  });

  const nodes_map = Object.assign(
    {},
    ...nodes.map((node) => {
      node.links = [];
      return { [node.id]: node };
    })
  );

  if (cacheKey) {
    const cache = localStorage.getItem(cacheKey);
    if (cache) {
      try {
        const obj = JSON.parse(cache);
        obj.scale && (scale = obj.scale);
        if (obj.translate) {
          panX = obj.translate.x;
          panY = obj.translate.y;
        }
        Array.isArray(obj.nodes) &&
          obj.nodes.forEach(({ id, x, y }) => {
            const node = nodes_map[id];
            if (node) {
              node.x = x;
              node.y = y;
            }
          });
      } catch {}
    }
  }

  const save = () => {
    if (!cacheKey) return;
    const cache = {
      scale,
      translate: {
        x: panX,
        y: panY
      },
      nodes: nodes
        .filter((n) => n.x && n.y)
        .map(({ id, x, y }) => ({ id, x, y }))
    };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  };

  const path = (link) => {
    const source = nodes_map[link.source];
    const target = nodes_map[link.target];
    const r = Math.hypot(target.x - source.x, target.y - source.y);
    link.d = `M${source.x},${source.y}A${r},${r} 0 0,1 ${target.x},${target.y}`;
    link.startOffset = r * Math.acos(0.5) - R - CHAR_W * 1.2;
  };

  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 10])
    .on("zoom", function (e) {
      scale = e.transform.k;
      panX = e.transform.x;
      panY = e.transform.y;
      save();
      d3.selectAll("svg > g").attr("transform", e.transform);
    });

  const svg = d3.create("svg").attr("height", height).call(zoom);

  const pathGroups = svg
    .append("g")
    .selectAll("g")
    .data(links)
    .enter()
    .append((d) => {
      path(d);
      return d.g;
    });

  const paths = pathGroups
    .append("path")
    .attr("id", (d) => `path-${d.id}`)
    .style("stroke", (d) => d.color)
    .attr("d", (d) => d.d);

  pathGroups
    .append("text")
    .attr("dy", CHAR_W / 2)
    .append("textPath")
    .attr("id", (d) => `dot-${d.id}`)
    .attr("xlink:href", (d) => `#path-${d.id}`)
    .text("⬤")
    .attr("startOffset", (d) => d.startOffset);

  const drag = d3
    .drag()
    .on("start", function () {
      d3.select(this).classed("dragging", true);
    })
    .on("drag", function ({ x, y }, d) {
      d.x = x;
      d.y = y;
      d3.select(this).attr("transform", `translate(${x},${y})`);
      paths.each(function (link) {
        if (link.source === d.id || link.target === d.id) {
          path(link);
          d3.select(this).attr("d", (d) => d.d);
          d3.select(`#dot-${link.id}`).attr("startOffset", link.startOffset);
        }
      });
    })
    .on("end", function () {
      d3.select(this).classed("dragging", false);
      debounce(save, 3000);
    });

  // nodes
  svg
    .append("g")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append((d) => d.g)
    .attr("transform", (d) => `translate(${d.x},${d.y})`)
    .call(drag);

  container.appendChild(svg.node());
  zoom.transform(svg, d3.zoomIdentity.translate(panX, panY).scale(scale));
};

export { d3, d3_tree, d3_graph, R, CHAR_W };
