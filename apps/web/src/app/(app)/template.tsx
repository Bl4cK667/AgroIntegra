import styles from './template.module.css';

// Remonta a cada troca de seção do menu: a página nova entra com um leve deslize.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}
