const DMG_MULIPLIER = 0.8

export function takeDamage(run, amount) {
  run.currentHealth = Math.max(0, run.currentHealth - amount);
  return run.currentHealth;
}

export function heal(run, amount) {
  run.currentHealth = Math.min(run.maxHealth, run.currentHealth + amount);
  return run.currentHealth;
}

export function levelUp(run) {
  const healthRatio = run.currentHealth / run.maxHealth;
  run.level += 1;
  run.maxHealth = 100 + (run.level - 1) * 20;
  run.currentHealth = Math.round(run.maxHealth * healthRatio);
  return run;
}

export function calculateDamageMultiplier(level) {
  return 1 + (level - 1) * DMG_MULIPLIER;
}