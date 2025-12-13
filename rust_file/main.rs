use chrono::{Datelike, NaiveDate, Duration, Weekday};
use std::f64::consts::SQRT_2;

const BUSINESS_DAYS_IN_YEAR: f64 = 252.0;

/// Funcao erro aproximada (Abramowitz & Stegun 7.1.26).
/// Evita dependencias externas para a CDF da normal padrao.
fn erf(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let abs_x = x.abs();
    
    let a1 = 0.254829592;
    let a2 = -0.284496736;
    let a3 = 1.421413741;
    let a4 = -1.453152027;
    let a5 = 1.061405429;
    let p = 0.3275911;

    let t = 1.0 / (1.0 + p * abs_x);
    let y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * (-abs_x * abs_x).exp();

    sign * y
}

/// CDF da normal padrao N(x) usando erf (precisao ~1e-7).
pub fn normal_cdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / SQRT_2))
}

/// Alias semantico para aderir a notacao N(x).
#[inline(always)]
pub fn n(x: f64) -> f64 {
    normal_cdf(x)
}

/// Conta dias uteis (segunda a sexta) entre duas datas.
/// Usa NaiveDate para garantir que não haja problemas de fuso horário (meia-noite).
pub fn calcular_dias_uteis(data_atual: NaiveDate, data_vencimento: NaiveDate) -> i32 {
    if data_vencimento <= data_atual {
        return 0;
    }

    let mut dias = 0;
    let mut cursor = data_atual;

    while cursor < data_vencimento {
        let dia_semana = cursor.weekday();
        // Em chrono: Sat e Sun são final de semana
        if dia_semana != Weekday::Sat && dia_semana != Weekday::Sun {
            dias += 1;
        }
        cursor += Duration::days(1);
    }

    dias
}

/// Converte diferenca de datas em anos usando 252 dias uteis.
pub fn calcular_tempo_em_anos(data_atual: NaiveDate, data_vencimento: NaiveDate) -> f64 {
    let dias_uteis = calcular_dias_uteis(data_atual, data_vencimento) as f64;
    dias_uteis / BUSINESS_DAYS_IN_YEAR
}

fn ensure_positive(value: f64) -> f64 {
    let fallback = 1e-12;
    if value > 0.0 { value } else { fallback }
}

/// Black-Scholes para opcao de compra europeia (CALL).
pub fn black_scholes_call(
    s: f64,
    k: f64,
    r: f64,
    sigma: f64,
    data_atual: NaiveDate,
    data_vencimento: NaiveDate,
) -> f64 {
    let t = calcular_tempo_em_anos(data_atual, data_vencimento);
    if t <= 0.0 {
        return (s - k).max(0.0);
    }

    let safe_sigma = ensure_positive(sigma);
    let sqrt_t = t.sqrt();
    let d1 = ((s / k).ln() + (r + 0.5 * safe_sigma * safe_sigma) * t) / (safe_sigma * sqrt_t);
    let d2 = d1 - safe_sigma * sqrt_t;

    s * normal_cdf(d1) - k * (-r * t).exp() * normal_cdf(d2)
}

/// Black-Scholes para opcao de venda europeia (PUT).
pub fn black_scholes_put(
    s: f64,
    k: f64,
    r: f64,
    sigma: f64,
    data_atual: NaiveDate,
    data_vencimento: NaiveDate,
) -> f64 {
    let t = calcular_tempo_em_anos(data_atual, data_vencimento);
    if t <= 0.0 {
        return (k - s).max(0.0);
    }

    let safe_sigma = ensure_positive(sigma);
    let sqrt_t = t.sqrt();
    let d1 = ((s / k).ln() + (r + 0.5 * safe_sigma * safe_sigma) * t) / (safe_sigma * sqrt_t);
    let d2 = d1 - safe_sigma * sqrt_t;

    k * (-r * t).exp() * normal_cdf(-d2) - s * normal_cdf(-d1)
}

/// Variante modificada do Black-Scholes com parametro p e fator A(tau).
/// tau = tempo ate o vencimento (anos).
pub fn black_scholes_call_modified(
    s: f64,
    k: f64,
    r: f64,
    sigma: f64,
    p: f64,
    data_atual: NaiveDate,
    data_vencimento: NaiveDate,
) -> f64 {
    let tau = calcular_tempo_em_anos(data_atual, data_vencimento);
    if tau <= 0.0 {
        return (s - k).max(0.0);
    }

    let safe_sigma = ensure_positive(sigma);
    let safe_p = ensure_positive(p);
    let sigma_sq = safe_sigma * safe_sigma;
    let sqrt_p_tau = (safe_p * tau).sqrt();
    
    // A(tau)
    let a_tau = ((safe_p - 1.0) * (sigma_sq / 2.0) * tau).exp();
    
    let base = (s / k).ln() - 0.5 * sigma_sq * tau + r * tau;
    let d1 = (base + safe_p * sigma_sq * tau) / (safe_sigma * sqrt_p_tau);
    let d2 = base / (safe_sigma * sqrt_p_tau);

    a_tau * s * normal_cdf(d1) - k * (-r * tau).exp() * normal_cdf(d2)
}

pub fn black_scholes_put_modified(
    s: f64,
    k: f64,
    r: f64,
    sigma: f64,
    p: f64,
    data_atual: NaiveDate,
    data_vencimento: NaiveDate,
) -> f64 {
    let tau = calcular_tempo_em_anos(data_atual, data_vencimento);
    if tau <= 0.0 {
        return (k - s).max(0.0);
    }

    let safe_sigma = ensure_positive(sigma);
    let safe_p = ensure_positive(p);
    let sigma_sq = safe_sigma * safe_sigma;
    let sqrt_p_tau = (safe_p * tau).sqrt();
    
    // A(tau)
    let a_tau = ((safe_p - 1.0) * (sigma_sq / 2.0) * tau).exp();

    let base = (s / k).ln() - 0.5 * sigma_sq * tau + r * tau;
    let d1 = (base + safe_p * sigma_sq * tau) / (safe_sigma * sqrt_p_tau);
    let d2 = base / (safe_sigma * sqrt_p_tau);

    k * (-r * tau).exp() * normal_cdf(-d2) - a_tau * s * normal_cdf(-d1)
}