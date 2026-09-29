/**
 * Message affiché après TOUTE demande de lien de réinitialisation acceptée (2xx). Volontairement une
 * constante du frontend et non le corps de la réponse : l'écran n'interprète ni ne différencie jamais ce
 * que répond le serveur, qui répond de toute façon la même chose que le compte existe ou non.
 */
export const FORGOT_PASSWORD_SUCCESS_MESSAGE = "Si un compte existe avec cet e-mail, un lien a été envoyé.";
