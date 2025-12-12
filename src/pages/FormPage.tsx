import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  blackScholesCall,
  blackScholesPut,
  blackScholesCallModified,
  blackScholesPutModified,
  calcularDiasUteis,
  calcularTempoEmAnos,
} from '../utils/blackScholes';
import { styles } from '../styles';
import { parseDate, formatDateInput } from '../utils/dateHelpers';
import { searchQuotes, type SearchItem } from '../api/search';

type FormState = {
  S: string;
  K: string;
  r: string;
  sigma: string;
  p: string;
  dataAtual: string;
  dataVencimento: string;
};

const today = new Date();
const defaultVencimento = new Date();
defaultVencimento.setDate(today.getDate() + 90);

const initialState: FormState = {
  S: '100',
  K: '105',
  r: '0.05',
  sigma: '0.2',
  p: '1.0',
  dataAtual: formatDateInput(today),
  dataVencimento: formatDateInput(defaultVencimento),
};

export default function FormPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchMessage('Informe um termo para pesquisar.');
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchMessage(null);
    setSearchResults([]);
    try {
      const results = await searchQuotes(searchTerm, 5);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchMessage('Nenhum ativo encontrado.');
      }
    } catch (err) {
      setSearchMessage('Erro ao buscar ativos.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
  };

  const calculateClassic = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseInputs(form, { requireP: false });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const { S, K, r, sigma, dataAtual, dataVencimento } = parsed;
    const diasUteis = calcularDiasUteis(dataAtual, dataVencimento);
    const T = calcularTempoEmAnos(dataAtual, dataVencimento);
    const call = blackScholesCall(S, K, r, sigma, dataAtual, dataVencimento);
    const put = blackScholesPut(S, K, r, sigma, dataAtual, dataVencimento);

    navigate('/resultado', {
      state: {
        variant: 'classico' as const,
        result: {
          call,
          put,
          T,
          diasUteis,
          inputs: form,
        },
      },
    });
  };

  const calculateModified = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseInputs(form, { requireP: true });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const { S, K, r, sigma, p, dataAtual, dataVencimento } = parsed;
    const diasUteis = calcularDiasUteis(dataAtual, dataVencimento);
    const T = calcularTempoEmAnos(dataAtual, dataVencimento);
    const call = blackScholesCallModified(
      S,
      K,
      r,
      sigma,
      p,
      dataAtual,
      dataVencimento,
    );
    const put = blackScholesPutModified(
      S,
      K,
      r,
      sigma,
      p,
      dataAtual,
      dataVencimento,
    );

    navigate('/resultado-modificado', {
      state: {
        variant: 'modificado' as const,
        p,
        result: {
          call,
          put,
          T,
          diasUteis,
          inputs: form,
        },
      },
    });
  };

  return (
    <main style={styles.container}>
      <div>
        <h1 style={styles.title}>Calculadora Black-Scholes</h1>
        <p style={styles.subtitle}>
          Preencha os parametros anuais. Datas sao usadas para calcular T (dias uteis/252).
        </p>
      </div>

      <div style={styles.searchRow}>
        <input
          style={{ ...styles.input, ...styles.searchInput, marginTop: 0 }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar ativo (ex: PETR4.SA, AAPL)"
        />
        <button
          style={{ ...styles.secondaryButton, marginTop: 0 }}
          type="button"
          onClick={handleSearch}
          disabled={searchLoading}
        >
          {searchLoading ? 'Buscando...' : 'Pesquisar'}
        </button>
      </div>

      {searchMessage ? <p style={styles.error}>{searchMessage}</p> : null}
      {searchResults.length > 0 ? (
        <ul style={styles.searchList}>
          {searchResults.map((item) => (
            <li
              key={`${item.symbol}-${item.exchange}`}
              style={styles.searchItem}
              onClick={() => {
                if (item.price) {
                  setForm((prev) => ({ ...prev, S: String(item.price) }));
                }
              }}
            >
              <div>
                <div style={styles.rowValue}>{item.symbol}</div>
                <div style={styles.searchMeta}>{item.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {item.price !== undefined ? (
                  <div style={styles.rowValue}>{item.price}</div>
                ) : null}
                {item.exchange ? (
                  <span style={styles.searchMeta}>{item.exchange}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form style={styles.form} onSubmit={handleSubmit}>
        <Input
          label="S - Preco do ativo"
          value={form.S}
          onChange={(e) => handleChange('S', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="K - Preco de exercicio"
          value={form.K}
          onChange={(e) => handleChange('K', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="r - Taxa livre de risco (anual, ex: 0.05)"
          value={form.r}
          onChange={(e) => handleChange('r', e.target.value)}
          inputMode="decimal"
        />
        <Input
          label="sigma - Volatilidade anual (ex: 0.2)"
          value={form.sigma}
          onChange={(e) => handleChange('sigma', e.target.value)}
          inputMode="decimal"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={styles.label}>
            p - Parametro (use apenas no modificado, sugestao: 0.5 a 1.5)
          </span>
          <input
            style={styles.input}
            value={form.p}
            onChange={(e) => handleChange('p', e.target.value)}
            inputMode="decimal"
            placeholder="1.0"
          />
        </div>
        <Input
          label="Data atual (DD/MM/AAAA)"
          value={form.dataAtual}
          onChange={(e) => handleChange('dataAtual', e.target.value)}
          inputMode="text"
          placeholder="12/12/2025"
        />
        <Input
          label="Data de vencimento (DD/MM/AAAA)"
          value={form.dataVencimento}
          onChange={(e) => handleChange('dataVencimento', e.target.value)}
          inputMode="text"
          placeholder="12/03/2026"
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            style={{ ...styles.button, ...styles.actionButton }}
            type="button"
            onClick={calculateClassic}
          >
            Calcular classico
          </button>
          <button
            style={{ ...styles.secondaryButton, ...styles.actionButton }}
            type="button"
            onClick={calculateModified}
          >
            Calcular modificado
          </button>
        </div>
      </form>
    </main>
  );
}

function Input({
  label,
  ...props
}: {
  label: string;
  value: string;
  inputMode?: 'decimal' | 'text';
  placeholder?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={styles.inputGroup}>
      <span style={styles.label}>{label}</span>
      <input style={styles.input} {...props} />
    </label>
  );
}

function parseInputs(
  form: FormState,
  { requireP }: { requireP: boolean },
):
  | {
      ok: true;
      S: number;
      K: number;
      r: number;
      sigma: number;
      p?: number;
      dataAtual: Date;
      dataVencimento: Date;
    }
  | { ok: false; error: string } {
  const S = Number(form.S);
  const K = Number(form.K);
  const r = Number(form.r);
  const sigma = Number(form.sigma);
  const p = Number(form.p);
  const dataAtual = parseDate(form.dataAtual);
  const dataVencimento = parseDate(form.dataVencimento);

  if ([S, K, r, sigma].some((n) => Number.isNaN(n))) {
    return { ok: false, error: 'Preencha valores numericos validos.' };
  }

  if (requireP && (Number.isNaN(p) || p <= 0)) {
    return { ok: false, error: 'Parametro p deve ser maior que zero.' };
  }

  if (!dataAtual || !dataVencimento) {
    return { ok: false, error: 'Datas devem estar no formato DD/MM/AAAA.' };
  }

  return {
    ok: true,
    S,
    K,
    r,
    sigma,
    ...(requireP ? { p } : {}),
    dataAtual,
    dataVencimento,
  };
}
