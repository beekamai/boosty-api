/** Strips control and bidi characters from text Boosty returns before it reaches a terminal line. */
export const printable = (text: string): string =>
    text.replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, "");
