---
layout: post
title: 层次化可导航小世界（HNSW）
subtitle: Today is new!
gh-repo: ULis3h/algorithm-visualizations
gh-badge: [star, fork, follow]
tags: [ANN, HNSW, vector quantization, ai, machine learning]
comments: true
mathjax: true
author: ULis3h
---
{: .box-success}
HNSW（层次化可导航小世界）是一种高效的最近邻搜索算法，在大规模向量检索中表现优异。它通过构建多层图结构，在保持高查询精度的同时，显著降低了搜索时间复杂度，从 O(n) 优化到近似 O(log n)。这篇文章将深入介绍 HNSW 的核心原理、实现方法以及实际应用场景。


## 算法背景

在大规模向量检索领域，如何快速准确地找到最近邻是一个关键问题。传统的精确最近邻搜索算法（如KD树、R树等）在处理高维数据时往往会遇到"维度灾难"的问题，其性能会随着维度的增加而急剧下降。为了解决这个问题，近似最近邻搜索（Approximate Nearest Neighbor, ANN）算法应运而生，而HNSW就是其中表现最优秀的算法之一。

### 近似最近邻搜索问题定义

给定一个包含n个d维向量的数据集合 $$S \subset \mathbb{R}^d $$，对于任意查询点 $$q \in \mathbb{R}^d$$，找到一个点 $$p \in S$$，使得：

$$d(p,q) \leq (1+\epsilon) \cdot d(p^*,q)$$

其中，$p^*$ 是真实的最近邻点，$$\epsilon > 0$$ 是近似因子，$$d(\cdot,\cdot)$$ 是距离度量函数。

### NSW的基础概念

在深入HNSW之前，我们需要理解NSW（Navigable Small World）图的概念。NSW是一种基于小世界网络理论的图结构，它具有以下特点：

1. 短平均路径长度：任意两个节点之间的平均跳数较小
2. 高聚集系数：节点的邻居之间也倾向于相互连接
3. 度分布呈现幂律分布：少数节点具有较多连接，大多数节点具有较少连接

### 为什么需要层次化结构

虽然NSW图能够提供高效的搜索路径，但在大规模数据集上，单层图结构的搜索效率仍然不够理想。HNSW通过引入层次化的结构，将搜索空间进行分层，实现了更高效的搜索策略。这种层次化结构的主要优势在于：

1. 在高层图中可以进行快速的粗粒度搜索
2. 随着层级下降，搜索范围逐渐缩小，实现精确定位
3. 通过控制每层的连接度，平衡了搜索效率和内存开销

## 数据结构设计

HNSW的核心是其独特的多层图结构设计，这种设计直接决定了算法的性能和效率。让我们详细了解其设计思想和具体实现。

### 多层图结构

HNSW将数据点组织成一个层次化的结构，包含多个层级的图：

- 最底层（第0层）包含所有数据点
- 上层图逐渐稀疏，节点数量呈指数衰减
- 每个节点在不同层级都保持相同的标识

图的形式化定义为：

$$G_l = (V_l, E_l), l = 0,1,...,L$$

其中：
- $$G_l$$ 表示第l层图
- $$V_l$$ 是第l层的节点集合
- $$E_l$$ 是第l层的边集合
- $$L$$ 是最大层数

### 层级划分策略

`HNSW`采用概率分层策略，每个节点的最大层级是通过随机函数确定的。具体来说：

1. 对于每个新插入的节点，其最大层级 $#l_{max}#$ 通过以下概率分布确定：

   $$P(l_{max} = l) = p^l(1-p)$$

   其中 $$p$$ 是一个常数（通常取0.5），这将产生一个几何分布。

2. 这种分层策略确保了：
   - 节点数量随层级增加呈指数衰减
   - 平均而言，第 $$l$$ 层的节点数约为 $n \cdot p^l$$
   - 最高层级期望为 $$O(\log_{1/p} n)$$

### 节点连接规则

HNSW的每层图都是一个近似最近邻图（Approximate k-NN Graph），其连接规则如下：

1. **邻居数量控制**：
   - 每层设置最大出度 $$M$$
   - 底层可以设置更大的最大出度 $$M_0$$
   - 实际实现中通常 $$M_0 = 2M$$

2. **邻居选择策略**：
   - 使用启发式算法选择最优邻居
   - 通过距离和已有连接关系进行筛选
   - 保持图的连通性和搜索效率

## 核心算法流程
### 构建过程
网络构建算法通过将存储的元素一次插入图结构中进行组织。

构建算法在原始论文的`Algorithm 1`中给出， 伪代码如下：
{: .box-note}
**INSERT(hnsw, q, M, Mmax, efConstruction, mL)**  
**输入：**  
- multilayer graph hnsw: 多层图 hnsw  
- new element q: 新元素 q  
- $$\(M\)$$: 已建立连接的数量 M  
- $$M_{\text{max}}$$ : 每层中每个元素的最大连接数 Mmax  
- size of the dynamic candidate list efConstruction: 动态候选列表的大小 efConstruction  
- normalization factor for level generation mL: 层级生成的归一化因子 mL  

**输出：**  
- update hnsw inserting element q: 更新后的 hnsw，插入了元素 q  

```plaintext
1  W ← ∅ // 当前找到的最近邻元素列表
2  ep ← get enter point for hnsw // 获取 hnsw 的进入点
3  L ← level of ep // ep 的层级（hnsw 的顶层）
4  l ← ⌊-ln(unif(0..1))∙mL⌋ // 新元素的层级
5  for lc ← L … l+1
6      W ← SEARCH-LAYER(q, ep, ef=1, lc) // 在层 lc 中搜索
7      ep ← get the nearest element from W to q // 从 W 中获取与 q 最近的元素
8  for lc ← min(L, l) … 0
9      W ← SEARCH-LAYER(q, ep, efConstruction, lc) // 在层 lc 中搜索
10     neighbors ← SELECT-NEIGHBORS(q, W, M, lc) // 使用算法3或算法4选择邻居
11     add bidirectionall connectionts from neighbors to q at layer lc // 在层 lc 中从 neighbors 到 q 添加双向连接
12     for each e ∈ neighbors // 如果需要，收缩连接
13         eConn ← neighbourhood(e) at layer lc // e 在层 lc 中的邻域
14         if │eConn│ > Mmax // 如果 e 的连接数超过 Mmax，收缩 e 的连接
           // 如果 lc = 0，则 Mmax = Mmax0
15             eNewConn ← SELECT-NEIGHBORS(e, eConn, Mmax, lc) // 使用算法3或算法4选择新的连接
16             set neighbourhood(e) at layer lc to eNewConn // 将 e 在层 lc 的邻域设置为 eNewConn
17     ep ← W // 更新进入点 ep
18 if l > L
19     set enter point for hnsw to q // 将 hnsw 的进入点设置为 q
```


### 搜索过程


## 算法分析
1. **时间复杂度分析**
2. **空间复杂度分析**
3. **实际应用场景**

## 代码实现
1. **数据结构设计**
2. **算法实现**
3. **实现细节**

## 总结与参考
1. **算法优势总结**
2. **原始论文引用**
3. **扩展阅读资料**