// When Next's image optimizer cannot fetch a cover in time (its upstream timeout is a
// fixed 7 seconds, and some cover hosts are slower), the resized image fails. This
// inline script, run before any image loads, swaps a failed cover for its original
// address so the visitor sees the full-size image instead of a blank frame. It is
// plain DOM code because the catalogue pages ship without React.
export const IMAGE_FALLBACK_SCRIPT = `document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG'||t.getAttribute('data-fell-back'))return;var o=t.getAttribute('data-original');if(!o)return;t.setAttribute('data-fell-back','1');t.removeAttribute('srcset');t.removeAttribute('sizes');t.src=o;},true);`;
