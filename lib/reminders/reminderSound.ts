/**
 * Sous-lot C3 — méthode SOUND : un bip généré via Web Audio API plutôt qu'un
 * fichier audio à héberger/charger, pour un rappel qui doit rester léger et ne
 * dépendre d'aucun asset externe. Ne fonctionne que si l'onglet est ouvert et
 * l'audio autorisé par le navigateur (limite déjà signalée à l'utilisateur dans
 * EventPanel — voir REMINDER_METHOD_HELP).
 */
export function playReminderSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.6);
    oscillator.onended = () => ctx.close();
  } catch {
    // Audio indisponible (permissions, navigateur) — silencieux, pas bloquant.
  }
}
