export const wait = (id) =>
  setTimeout(() => (document.location = `/${id}`), 1000);

export const getState = () => {
  const __state__ = document.getElementById("__state__");
  if (__state__) {
    const state = JSON.parse(__state__.innerText);
    __state__.remove();
    return state;
  }
};
