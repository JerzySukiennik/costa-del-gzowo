// Costa del Gzowo: radio station switcher, a carousel of station covers shown while tuning.
export function createRadioSwitcher(root, stations) {
  root.textContent = '';
  const strip = document.createElement('div');
  strip.className = 'rs-strip';
  const genre = document.createElement('small');
  const name = document.createElement('b');
  const track = document.createElement('span');
  const slots = [...stations, { id: 'off', name: 'Radio off', frequency: '', genre: '' }];
  const tiles = slots.map((station) => {
    const tile = document.createElement('div');
    tile.className = 'rs-tile';
    const label = document.createElement('i');
    label.textContent = station.id === 'off' ? 'OFF' : station.name;
    tile.appendChild(label);
    if (station.id !== 'off') {
      const image = new Image();
      image.alt = '';
      image.decoding = 'async';
      image.addEventListener('load', () => tile.classList.add('has-cover'));
      image.src = `assets/radio/${station.id}.jpg`;
      tile.appendChild(image);
    } else tile.classList.add('rs-off');
    strip.appendChild(tile);
    return tile;
  });
  root.append(strip, genre, name, track);
  let timer = 0;

  function layout(current) {
    const n = tiles.length;
    tiles.forEach((tile, i) => {
      let d = i - current;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      const a = Math.abs(d);
      const scale = a === 0 ? 1 : a === 1 ? 0.62 : 0.44;
      const x = Math.sign(d) * (a === 0 ? 0 : a === 1 ? 128 : 128 + (a - 1) * 84);
      tile.style.transform = `translate(-50%, -50%) translateX(${x}px) scale(${scale})`;
      tile.style.opacity = a === 0 ? '1' : a === 1 ? '0.6' : a === 2 ? '0.28' : '0';
      tile.style.zIndex = String(10 - a);
      tile.classList.toggle('current', a === 0);
    });
  }
  layout(0);

  return {
    show(index, trackText) {
      const current = index < 0 ? slots.length - 1 : index;
      const station = slots[current];
      layout(current);
      genre.textContent = station.genre;
      name.textContent = station.frequency ? `${station.name} ${station.frequency}` : station.name;
      track.textContent = trackText || '';
      root.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('on'), 4200);
    },
  };
}
