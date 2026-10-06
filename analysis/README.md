# Analysis code

This directory contains the analysis  code associated with the paper:

**"A multidimensional normative database of experiential ratings for German nouns"**

The analyses are organized in the following order:

### 1_cross_database_validation.ipynb

Compares the ratings from the present database with established German normative databases.

The external datasets required to run this analysis can be downloaded from the following sources:

- Köper and Im Walde (2016): https://www.ims.uni-stuttgart.de/forschung/ressourcen/experiment-daten/affective-norms/ 
- Kanske and Kotz (2010):    https://link.springer.com/article/10.3758/BRM.42.4.987

### 2_longitudinal_test_retest_reliability.ipynb

Calculates test–retest correlations for the rating dimensions based on the first and second rating sessions.

### 3_exploratory_factor_analysis.ipynb

Performs the exploratory factor analysis of the experiential rating dimensions.

The notebook also generates the factor-reduced dataset which is used in the subsequent cluster analysis.

### 4_cluster_analysis.ipynb

Performs the cluster analysis based on the factor scores generated in the exploratory factor analysis.

The analysis produces a dataset assigning each word to its corresponding cluster.


## Software and environment

The analyses were performed using Python 3.12.3 and Jupyter Notebook 7.0.8.
