/** First-launch intro flag. Plain module (not "use client"), so the server layout can inline the script text. */
export const WELCOMED_KEY = "sylvia.welcomed";
/** Runs in <head>: hides the intro before first paint for anyone who has seen it, so it never flashes. */
export const WELCOME_SCRIPT = `try{if(localStorage.getItem("${WELCOMED_KEY}"))document.documentElement.classList.add("welcomed")}catch(e){}`;
