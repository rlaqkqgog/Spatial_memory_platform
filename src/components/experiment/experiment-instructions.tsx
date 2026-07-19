export function ExperimentInstructions() {
  return (
    <section
      aria-labelledby="instructions-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 id="instructions-title" className="text-lg font-semibold text-slate-900">
        응답 방법
      </h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
        <li>색상을 선택합니다.</li>
        <li>
          <span className="font-semibold text-slate-800">스페이스바를 누르고 있으면</span> 손바닥 모드가 되어
          드래그로 평면도를 이동할 수 있습니다. 마우스 휠이나 +/− 버튼으로 확대·축소합니다.
        </li>
        <li>기억나는 위치를 평면도에서 클릭해 마커를 놓습니다.</li>
        <li>마커는 드래그하여 옮길 수 있고, × 버튼으로 삭제할 수 있습니다.</li>
        <li>모든 색상에서 3개씩, 총 12개를 입력한 뒤 제출합니다.</li>
      </ol>
    </section>
  );
}
