import { hazardClassItems } from "./HazardLayer";

export default function HazardLegend() {
  return (
    <section className="panel legend">
      <h2>Легенда</h2>
      <ul>
        {hazardClassItems.map((item) => (
          <li key={item.className}>
            <span className="legend-swatch" style={{ backgroundColor: item.color }} />
            <span>{item.className}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
