# Skill 扩展点

Skill 元数据在 `data/skills.json`，版本在 `data/skill-versions.json`。
每个技能初始化为 `<id>/SKILL.md`。运营保存后生成 `<id>/revisions/<uuid>.md`，注册项 `filePath` 指向当前正文；旧文件不可变，版本快照保留完整元数据和正文。

通过 `/skills` 编辑，不直接覆盖正文文件。执行器会核对文件与注册正文的一致性，不一致时拒绝执行。当前运行器是 `src/lib/services/executor.ts` 的确定性本地适配器；非 `local-rules` 模型在接入前会明确拒绝测试。

客户端不能直接访问文件；路径由服务端生成，拒绝任意路径、父目录穿越和符号链接。`SNACKOPS_SKILLS_DIR` 可用于项目内隔离测试，但不能指向项目外目录。API 和一致性说明见根目录 `REGISTRY.md`。
