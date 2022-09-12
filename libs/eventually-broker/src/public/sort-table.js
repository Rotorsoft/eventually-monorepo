let sortCol = -1,
  sortOrder = 0;

const compare_cells = (a, b) => a > b;
const compare_length_first = (a, b) =>
  a.length === b.length ? a > b : a.length > b.length;

const sort = (col, comp_len) => {
  const tables = document.getElementsByClassName("sorted-table");
  if (!tables.length) return;
  const table = tables[0];

  const compare = comp_len ? compare_length_first : compare_cells;

  sortCol >= 0 &&
    table.rows[0].cells[sortCol].classList.remove("sorted-asc", "sorted-desc");
  sortOrder = sortCol === col ? 1 - sortOrder : 0;
  sortCol = col;
  table.rows[0].cells[col].classList.add(
    sortOrder ? "sorted-desc" : "sorted-asc"
  );

  const swap = (row) => {
    const ra = table.rows[row];
    const rb = table.rows[row + 1];
    if (ra && rb) {
      const a = ra.cells[col].innerHTML.toLowerCase();
      const b = rb.cells[col].innerHTML.toLowerCase();
      return a != b && Boolean(+compare(a, b) - sortOrder);
    }
  };

  for (row = 1; row < table.rows.length; row++) {
    while (row > 0 && swap(row)) {
      table.rows[row].parentNode.insertBefore(
        table.rows[row + 1],
        table.rows[row]
      );
      row--;
    }
  }
};
