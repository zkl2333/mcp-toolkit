# Changesets

你好！这个文件夹用于管理版本变更。

## 使用方法

当你对代码进行更改时，请运行：

```bash
bun changeset
```

这将引导你创建一个变更集文件，描述你的更改以及它们应该触发的版本升级类型（patch、minor 或 major）。

当你准备发布时，运行：

```bash
bun changeset:version
```

这将应用所有变更集，更新包版本，并生成更新日志。

然后运行：

```bash
bun changeset:publish
```

来发布包到 npm。

## 更多信息

请参阅 https://github.com/changesets/changesets 获取更多详细信息。
