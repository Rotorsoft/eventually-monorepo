import { getState } from "/_public/js/utils.js";

document.addEventListener("DOMContentLoaded", function () {
  const service = getState();

  const delId = document.getElementById("deleteId");
  const delBtn = document.getElementById("deleteButton");

  if (delId && delBtn) {
    delId.onkeyup = (ev) => {
      const enable = delId.value === service.id;
      enable
        ? delBtn.classList.remove("disabled")
        : delBtn.classList.add("disabled");
    };
    delBtn.onclick = () => {
      fetch(`/_services/${service.id}`, { method: "delete" })
        .then((response) => response.json())
        .then((json) => {
          if (json.deleted) document.location = "/_services";
          else {
            delId.value = "";
            alert(json.message);
          }
        })
        .catch((error) => {
          delId.value = "";
          alert(json.message);
        });
    };
  }
});
