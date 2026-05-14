import os
import json
import argparse


def create_mapping(clustering_dir):
    cluster_files = [i for i in os.listdir(clustering_dir) if i.startswith("cluster_iter_")]
    num_iter = len(cluster_files)
    mapping = [None]*num_iter
    for f in cluster_files:
        with open(os.path.join(clustering_dir, f"cluster_iter_{num_iter-1}.json")) as f:
            cluster_map = json.load(f)
            cluster_map_reverse = {}
            for k in cluster_map.keys():
                cluster_map_reverse.update({v.lower(): k.lower() for v in cluster_map[k]})
        mapping[num_iter-1]=cluster_map_reverse
        num_iter -= 1
    generated_label_map = mapping[0].copy()
    print(f"Number of labels: {len(generated_label_map.keys())}")

    abandoned_labels = {}
    num_iter = len(mapping)
    for i in range(1, num_iter):    
        for k in list(generated_label_map.keys()):
            try:
                new_key = generated_label_map[k]
                generated_label_map[k] =  mapping[i][new_key]
            except KeyError:
                abandoned_labels.setdefault(i, []).append(new_key)
                generated_label_map.pop(k)
        print(f"Iteration {i}: {len(generated_label_map.keys())} labels left")
    return generated_label_map

def map_clusters(generation_file, generated_label_map):
    with open(generation_file) as f:
        generation = json.load(f)
    missed_labels = []
    for k in generation.keys():
        try:
            for a in generation[k]['LLM_Annotation']:
                new_labels = []
                for l in a['label']:
                    final_cluster = generated_label_map.get(l.lower())
                    if final_cluster is None:
                        missed_labels.append(l)
                    else:
                        new_labels.append(final_cluster)
                new_labels = list(set(new_labels)) #remove duplicates
                a.update({"label": new_labels})
        except KeyError:
            continue

    generation = {k: v for k, v in generation.items() if 'LLM_Annotation' in v.keys()}
    for k in generation.keys():
        annotation_wo_empty = [a for a in generation[k]['LLM_Annotation'] if len(a['label']) > 0]
        generation[k]['LLM_Annotation'] = annotation_wo_empty
    generation = {k: v for k, v in generation.items() if len(v['LLM_Annotation']) >0}
    return generation

