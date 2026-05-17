// src/components/BatchEditor.tsx より、useEffect 部分を以下に差し替え

  useEffect(() => {
    if (initialEvent && initialEvent.isBatch) {
      setMemoTitle(initialEvent.title);

      const memo = initialEvent.memo ?? '';
      const lines = memo.split('\n').map((l: string) => l.trim()).filter((l: string) => l !== '');

      if (lines.length > 0) {
        const extractedItems: BatchItem[] = lines.map((line: string, i: number) => {
          const checked = /^☑/.test(line);
          // 先頭の記号を除去して純粋なテキストにする
          const cleanText = line.replace(/^[□☑]\s*/, '').trim();
          
          return {
            id: `item-${Date.now()}-${i}`,
            // 💡 【修正】入力欄のフォーマットを「□　内容」または「☑　内容」に統一して1行ずつ流し込む
            text: `${checked ? '☑' : '□'}　${cleanText}`,
            checked,
          };
        });

        // 💡 【修正】抽出した予定が元の入力欄目安（3つ以上）で埋まってしまった場合のみ、空枠を3つ追加する
        if (extractedItems.length >= 3) {
          const emptyItems: BatchItem[] = Array(3).fill(null).map((_: null, i: number) => ({
            id: `item-${Date.now()}-empty-${i}`,
            text: '□　',
            checked: false,
          }));
          setItems([...extractedItems, ...emptyItems]);
        } else {
          // 3つ未満のときはそのままセット
          setItems(extractedItems);
        }
      } else {
        setItems(parseBatchMemo(memo));
      }
    } else {
      setMemoTitle('□MEMO');
      setItems([
        { id: `item-1`, text: '□　', checked: false },
        { id: `item-2`, text: '□　', checked: false },
        { id: `item-3`, text: '□　', checked: false },
      ]);
    }
  }, [initialEvent]);
