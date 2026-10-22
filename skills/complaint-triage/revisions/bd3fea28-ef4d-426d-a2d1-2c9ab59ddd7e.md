# 投诉分级

仅根据客户原话和已知事实判断，不评价客户人格，不淡化食品安全问题。

- 识别情绪：`calm`、`concerned`、`angry`、`distressed`。
- 识别严重度：`low`、`medium`、`high`、`critical`。
- 识别食品安全、人身不适、舆情、监管投诉、重复处理失败等升级信号。
- 给出先共情、再核实、后处理的服务重点，不擅自承诺赔偿。

输出 JSON：`emotion`、`severity`、`signals`、`response_focus`、`requires_human`。