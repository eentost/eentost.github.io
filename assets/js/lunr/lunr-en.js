---
layout: none
---

$(document).ready(function() {
  $('input#search').on('input', function () {
    var resultdiv = $('#results');
    // Literal matching supports Korean text without English stemming/fuzzy matches.
    var query = $(this).val().trim().toLowerCase();
    var terms = query ? query.split(/\s+/) : [];
    var result = [];
    if (terms.length) {
      store.forEach(function (doc, ref) {
        var title = doc.title.toLowerCase();
        var text = [doc.title, doc.excerpt, doc.categories, doc.tags].join(' ').toLowerCase();
        if (terms.every(function (term) { return text.indexOf(term) !== -1; })) {
          result.push({ ref: ref, score: title.indexOf(query) !== -1 ? 1 : 0 });
        }
      });
      result.sort(function (a, b) { return b.score - a.score; });
    }
    resultdiv.empty();
    resultdiv.prepend('<p class="results__found">'+result.length+' {{ site.data.ui-text[site.locale].results_found | default: "Result(s) found" }}</p>');
    for (var item in result) {
      var ref = result[item].ref;
      if(store[ref].teaser){
        var searchitem =
          '<div class="list__item">'+
            '<article class="archive__item" itemscope itemtype="https://schema.org/CreativeWork">'+
              '<h2 class="archive__item-title" itemprop="headline">'+
                '<a href="'+store[ref].url+'" rel="permalink">'+store[ref].title+'</a>'+
              '</h2>'+
              '<div class="archive__item-teaser">'+
                '<img src="'+store[ref].teaser+'" alt="">'+
              '</div>'+
              '<p class="archive__item-excerpt" itemprop="description">'+store[ref].excerpt.split(" ").splice(0,20).join(" ")+'...</p>'+
            '</article>'+
          '</div>';
      }
      else{
    	  var searchitem =
          '<div class="list__item">'+
            '<article class="archive__item" itemscope itemtype="https://schema.org/CreativeWork">'+
              '<h2 class="archive__item-title" itemprop="headline">'+
                '<a href="'+store[ref].url+'" rel="permalink">'+store[ref].title+'</a>'+
              '</h2>'+
              '<p class="archive__item-excerpt" itemprop="description">'+store[ref].excerpt.split(" ").splice(0,20).join(" ")+'...</p>'+
            '</article>'+
          '</div>';
      }
      resultdiv.append(searchitem);
    }
  });
});
