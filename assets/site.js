
document.addEventListener("DOMContentLoaded",()=>{
 const search=document.querySelector("[data-guide-search]");
 if(search){const cards=[...document.querySelectorAll("[data-guide-card]")];search.addEventListener("input",()=>{const q=search.value.trim().toLowerCase();cards.forEach(c=>{c.hidden=!c.innerText.toLowerCase().includes(q)})})}
 const form=document.querySelector("[data-care-check]");
 if(form){form.addEventListener("submit",e=>{e.preventDefault();const light=form.elements.light.value,soil=form.elements.soil.value,drain=form.elements.drain.value;let msg="오늘은 흙 상태와 식물 종류를 한 번 더 확인하세요.";if(soil==="dry"&&drain==="yes")msg="흙이 말랐고 배수구가 있다면, 화분 아래로 물이 빠질 때까지 천천히 충분히 주세요. 받침의 고인 물은 비우세요.";if(soil==="wet")msg="흙이 아직 젖어 있다면 지금은 물을 주지 말고 통풍과 배수 상태를 확인하세요.";if(drain==="no")msg="배수구가 없는 화분은 물이 고이기 쉽습니다. 물 주기보다 배수 가능한 속화분 사용을 먼저 검토하세요.";if(light==="low")msg+=" 빛이 약한 곳에서는 흙이 천천히 마르므로 물 주는 간격도 길어질 수 있습니다.";form.querySelector("[data-care-result]").textContent=msg;})}
});
