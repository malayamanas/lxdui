App.containers = App.containers || {
    data:[],
    error:false,
    errorMessage:'',
    loading:false,
    selectedContainers: [],

    dataTable:null,
    initiated:false,
    tableSettings: {
        rowId:'name',
        searching:true,
        responsive: true,
        select: true,
        columnDefs: [
            {
                orderable: false,
                className: 'select-checkbox',
                targets:   0
            }
        ],
        select: {
            style:    'multi',
            selector: 'td:first-child'
        },
        order: [[ 1, 'asc' ]],
    },
    newContainerForm:null,
    init: function(){
        console.log('Containers init');
        this.dataTable = $('#tableContainers').DataTable(this.tableSettings);
        $('#refreshContainers').on('click', $.proxy(this.refreshContainers, this));
        $('#buttonStart').on('click', $.proxy(this.startContainer, this));
        $('#buttonStop').on('click', $.proxy(this.stopContainer, this));
        $('#buttonRestart').on('click', $.proxy(this.restartContainer, this));
        $('#buttonDelete').on('click', $.proxy(this.deleteContainer, this));
        $('#buttonNewInstance').on('click', $.proxy(this.switchView, this, 'form'));
        $('#buttonBack').on('click', $.proxy(this.switchView, this, 'list'));
        this.dataTable.on('select', $.proxy(this.onRowSelected, this));
        this.dataTable.on('deselect', $.proxy(this.onRowSelected, this));
        this.getData();
        this.newContainerForm = $('#newContainerForm');
        this.newContainerForm.on('submit', $.proxy(this.doCreateContainer, this));
        if(window.location.hash && window.location.hash=='#createContainer')
            this.switchView('form')
    },
    refreshContainers: function(e){
        console.log('refreshContainers');
        e.preventDefault();
        this.getData();
    },
    setLoading: function(state){
        this.loading=true;
    },
    getData: function(){
        this.setLoading(true);
        $.get(App.baseAPI+'container', $.proxy(this.getDataSuccess, this));
    },
    getDataSuccess: function(response){
        this.setLoading(false);
        this.data = response.data;
        if(!this.initiated)
            return this.initiated = true;
        this.dataTable.clear();
        this.dataTable.destroy();
        this.dataTable=$('#tableContainers').DataTable(App.mergeProps(this.tableSettings, {
            data:this.data,
            columns : [
                { title:'#', data: null, defaultContent:''},
                { title:'Name', data : 'name'},
                { title:'Status', data : 'status' },
                { title:'IP Address', data : 'network',
                    render: function(field) {
                        if (!field || field['eth0']['addresses'].length === 0) return 'N/A';
                        return field['eth0']['addresses'][0]['address'];
                    }
                },
                { title:'OS Image', data : 'config',
                    render:function(field){
                        return field['image.distribution'];
                    }
                },
                { title:'Create at', data : 'created_at' }
            ]
        }));
    },
    onRowSelected: function(e, dt, type, indexes ){
        var state = this.dataTable.rows({selected:true}).count()>0?'visible':'hidden';
        $('#buttonStart').css('visibility',state);
        $('#buttonStop').css('visibility',state);
        $('#buttonRestart').css('visibility',state);
        $('#buttonDelete').css('visibility',state);
    },
    startContainer: function(){
        this.dataTable.rows( { selected: true } ).data().map(function(row){
            $.ajax({
                url: App.baseAPI+'container/start/' + row['name'],
                type: 'PUT',
                success: $.proxy(this.onStartSuccess, this, row['name'])
            });
        }.bind(this));
    },
    onStartSuccess: function(name){
        $('.success-msg').text('Container ' + name + 'has been started')
        var parent = $('.success-msg').parent().toggleClass('hidden');
        setTimeout(function(){
          parent.toggleClass('hidden');
        }, 10000)
    },
    stopContainer: function() {
        this.dataTable.rows( { selected: true } ).data().map(function(row){
            $.ajax({
                url: App.baseAPI+'container/stop/' + row['name'],
                type: 'PUT',
                success: $.proxy(this.onStopSuccess, this, row['name'])
            });
        }.bind(this));
    },
    onStopSuccess: function(name){
        $('.success-msg').text('Container ' + name + ' has been stopped');
        var parent = $('.success-msg').parent().toggleClass('hidden');

        setTimeout(function(){
          parent.toggleClass('hidden');
        }, 10000);
    },
    restartContainer: function() {
        this.dataTable.rows( { selected: true } ).data().map(function(row){
            $.ajax({
                url: App.baseAPI+'container/restart/' + row['name'],
                type: 'PUT',
                success: $.proxy(this.onRestartSuccess, this, row['name'])
            });
        }.bind(this));
    },
    onRestartSuccess: function(name){
        $('.success-msg').text('Container ' + name + ' has been restarted');
        var parent = $('.success-msg').parent().toggleClass('hidden');

        setTimeout(function(){
          parent.toggleClass('hidden');
        }, 10000);
    },
    deleteContainer: function() {
        this.dataTable.rows( { selected: true } ).data().map(function(row){
            $.ajax({
                url: App.baseAPI+'container/' + row['name'],
                type: 'DELETE',
                data:JSON.stringify({force:true}),
                success: $.proxy(this.onDeleteSuccess, this, row['name'])
            });
        }.bind(this));
    },

    onDeleteSuccess: function(name){
        this.dataTable.row("#"+name).remove().draw();
        $('.success-msg').text('Container ' + name + ' has been removed');
        var parent = $('.success-msg').parent().toggleClass('hidden');

        setTimeout(function(){
          parent.toggleClass('hidden');
        }, 10000);

    },
    switchView: function(view){
        $('#createContainerForm')[view=='form'?'show':'hide']();
        $('#containers')[view=='list'?'show':'hide']();
    },
    generateRequest: function(formData){
        return {
            name: formData.name,
            image: formData.image,
            autostart: formData['autostart']?true:false,
            stateful: formData['stateful']?true:false,
            cpu:{
                percentage: Number(formData.cpu.percentage),
                hardLimitation: formData.cpu['hardLimitation']?true:false,
            },
            memory:{
                sizeInMB: Number(formData.memory.sizeInMB),
                hardLimitation: formData.memory['hardLimitation']?true:false
            },
            profiles:formData.profiles
        };
    },
    doCreateContainer: function(e){
        e.preventDefault();
        //Workaround for multiselect input
        var jsonForm = this.newContainerForm.serializeJSON();
        if($('#containerProfiles').val())
            jsonForm['profiles'] = $('#containerProfiles').val()

        var tempJSON = this.generateRequest(jsonForm);
        $.ajax({
            url: App.baseAPI +'container/',
            type:'POST',
            dataType:'json',
            contentType: 'application/json',
            data: JSON.stringify(tempJSON),
            success: $.proxy(this.onCreateSuccess, this),
            error: $.proxy(this.onCreateFailed, this)
        });
    },
    onCreateSuccess: function(response){
        this.switchView('list');
        this.newContainerForm.trigger('reset');
        this.getData();
    },
    onCreateFailed: function(response){
        console.log('createContainerFailed', response);
    }
}