# Capítulo 1: Álgebra Linear

## 1.1 Espaços Vetoriais

**Definição 1.1** (Espaço Vetorial)

Seja $\mathbb{F}$ um corpo. Um *espaço vetorial* sobre $\mathbb{F}$ é um conjunto não vazio $V$ munido de duas operações:
- adição: $V \times V \to V$, $(u, v) \mapsto u + v$
- multiplicação por escalar: $\mathbb{F} \times V \to V$, $(\lambda, v) \mapsto \lambda v$

**Teorema 1.1** (Unicidade do elemento neutro)

O elemento neutro da adição em $V$ é único.

**Demonstração:**
Suponhamos que $0$ e $0'$ são elementos neutros. Então:
$$0 = 0 + 0' = 0'$$

## 1.2 Transformações Lineares

**Definição 1.2** (Transformação Linear)

Uma aplicação $T: V \to W$ diz-se *linear* se para todos $u, v \in V$ e $\lambda \in \mathbb{F}$:
$$T(u + v) = T(u) + T(v), \quad T(\lambda v) = \lambda T(v)$$

A matriz de $T$ na base $\mathcal{B} = \{e_1, \ldots, e_n\}$ é:
$$[T]_\mathcal{B} = \begin{pmatrix} T(e_1) & T(e_2) & \cdots & T(e_n) \end{pmatrix}$$

**Exemplo 1.1**

Seja $T: \mathbb{R}^2 \to \mathbb{R}^2$ a rotação de ângulo $\theta$. A sua matriz é:
$$R_\theta = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix}$$

# Capítulo 2: Cálculo Diferencial

## 2.1 Derivadas

**Definição 2.1** (Derivada)

A derivada de $f$ no ponto $a$ é o limite:
$$f'(a) = \lim_{h \to 0} \frac{f(a+h) - f(a)}{h}$$

quando este limite existe.

**Teorema 2.1** (Regra da cadeia)

Se $f$ é diferenciável em $a$ e $g$ é diferenciável em $f(a)$, então:
$$(g \circ f)'(a) = g'(f(a)) \cdot f'(a)$$

**Exemplo 2.1**

Calcule a derivada de $h(x) = \sin(x^2)$.

Resolução: Seja $f(x) = x^2$ e $g(u) = \sin(u)$.
$$h'(x) = \cos(x^2) \cdot 2x = 2x\cos(x^2)$$
